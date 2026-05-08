"""

Router: /api/v1/resources

Storage: MinIO (s3.iotiq.dev) — no local disk writes.
  - Upload   → bytes → MinIO
  - Process  → bytes from MinIO → AI extraction
  - Download → presigned redirect

"""

import os
import uuid
import logging

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.db.models import User, CourseResource, AiExtractedContent
from app.ai.pdf_parser import extract_text_from_bytes
from app.ai.content_extractor import extract_content_from_markdown
from app.ai.link_extractor import extract_text_from_link, detect_url_type
from app.schemas import (
    UploadResponseOut,
    ResourceListItemOut,
    ResourceResultOut,
    ResourceContentOut,
    LinkResourceOut,
)
from app.storage.minio_client import (
    upload_bytes as minio_upload_bytes,
    get_presigned_url,
    object_exists,
    make_object_key,
    get_content_type,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["resources"])

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png", ".jpg", ".jpeg",
    ".cpp", ".h", ".c", ".cc",
    ".py", ".js", ".ts", ".java",
    ".txt", ".md",
}

MAX_FILE_SIZE_MB = 10


# ─── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponseOut, summary="Upload a course resource file (PDF, image, code, text)")
async def upload_resource(
    file: UploadFile = File(...),
    week_name: Optional[str] = Form(None),
    class_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a file directly to MinIO and create a DB record.
    Call `POST /{resource_id}/process` afterwards to trigger AI extraction.
    Allowed types: PDF, PNG/JPG, C/C++/Python/JS/TS/Java, TXT, MD. Max size: 10 MB.
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Only instructors can upload resources.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Allowed: {ALLOWED_EXTENSIONS}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.",
        )

    resource_id  = str(uuid.uuid4())
    safe_filename = f"{resource_id}{suffix}"
    minio_key    = make_object_key(resource_id, safe_filename)
    content_type = get_content_type(safe_filename)

    # Upload directly to MinIO — no local disk write
    try:
        minio_upload_bytes(file_bytes, minio_key, content_type)
        logger.info(f"[MinIO] Uploaded: {minio_key} ({len(file_bytes)} bytes)")
    except Exception as exc:
        logger.error(f"[MinIO] Upload failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}")

    # Persist DB record — file_path stores the MinIO object key
    resource = CourseResource(
        id=resource_id,
        instructor_id=current_user.id,
        class_id=class_id,
        filename=file.filename or safe_filename,
        file_path=minio_key,          # MinIO key, NOT a local path
        file_type=suffix.lstrip("."),
        week_name=week_name,
        status="uploaded",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return {
        "resource_id": resource.id,
        "filename":    resource.filename,
        "status":      resource.status,
        "message":     "File uploaded to MinIO. Use /process to trigger AI content extraction.",
    }


# ─── Process (AI extraction) ─────────────────────────────────────────────────

@router.post("/{resource_id}/process", summary="Trigger AI extraction for an uploaded resource")
def process_resource(
    resource_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    class_id: Optional[str] = None,
    instructor_prompt: Optional[str] = None,
):
    """
    Trigger AI processing of an uploaded resource in the background:
    1. File bytes are fetched from MinIO
    2. Text is extracted (PDF, code, etc.)
    3. GPT extracts Topics / Lessons / Problems
    4. Results are persisted to the database

    Processing can take 30–60 seconds for large PDFs.
    Poll `GET /{resource_id}/result` for status.
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Only instructors can process resources.")

    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")
    if resource.status == "processing":
        raise HTTPException(status_code=409, detail="This resource is already being processed.")
    if resource.status == "done":
        raise HTTPException(status_code=409, detail="This resource has already been processed. Upload a new file to reprocess.")

    resource.status = "processing"
    if class_id and not resource.class_id:
        resource.class_id = class_id
    resource.updated_at = datetime.now(timezone.utc)
    db.commit()

    background_tasks.add_task(
        _process_resource_task,
        resource_id=resource_id,
        minio_key=resource.file_path,     # file_path now holds the MinIO key
        filename=resource.filename,
        week_name=resource.week_name,
        class_id=class_id or resource.class_id,
        instructor_prompt=instructor_prompt or "",
    )

    return {
        "resource_id": resource_id,
        "status":      "processing",
        "message":     "Processing started. Poll /resources/{id}/result for status.",
    }


# ─── Poll result ─────────────────────────────────────────────────────────────

@router.get("/{resource_id}/result", response_model=ResourceResultOut, summary="Poll processing status of an uploaded resource")
def get_resource_result(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the current processing status and extracted content counts for a resource."""
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    extraction = (
        db.query(AiExtractedContent)
        .filter(AiExtractedContent.resource_id == resource_id)
        .order_by(AiExtractedContent.created_at.desc())
        .first()
    )

    return {
        "resource_id":      resource_id,
        "filename":         resource.filename,
        "status":           resource.status,
        "error_message":    resource.error_message,
        "topics_created":   extraction.topics_created   if extraction else 0,
        "lessons_created":  extraction.lessons_created  if extraction else 0,
        "problems_created": extraction.problems_created if extraction else 0,
        "created_at":       resource.created_at,
        "updated_at":       resource.updated_at,
    }


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ResourceListItemOut], summary="List all resources for the instructor")
def list_resources(
    class_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all resources uploaded by the instructor. Optionally filter by class_id."""
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Instructor access required.")

    q = db.query(CourseResource).filter(CourseResource.instructor_id == current_user.id)
    if class_id:
        q = q.filter(CourseResource.class_id == class_id)

    resources = q.order_by(
        CourseResource.week_name.nullslast(),
        CourseResource.created_at.desc(),
    ).all()

    return [
        {
            "resource_id":   r.id,
            "filename":      r.filename,
            "file_type":     r.file_type,
            "week_name":     r.week_name,
            "status":        r.status,
            "error_message": r.error_message,
            "source_url":    r.source_url,
            "has_file":      bool(r.file_path and r.file_path.strip()),
            "download_url":  f"/api/v1/resources/{r.id}/download" if (r.file_path and r.file_path.strip()) else None,
            "created_at":    r.created_at,
        }
        for r in resources
    ]


# ─── Resource → Topics lookup ─────────────────────────────────────────────────

@router.get("/{resource_id}/topics", summary="Get topics generated from a specific resource")
def get_topics_by_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all topics (with lesson + problem counts) that were generated
    from the given resource via AI extraction (Topic.source_resource_id).
    """
    from app.db.models import Topic, Lesson, Problem

    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    topics = (
        db.query(Topic)
        .filter(Topic.source_resource_id == resource_id)
        .order_by(Topic.display_order)
        .all()
    )

    result = []
    for t in topics:
        lesson_count  = db.query(Lesson).filter(Lesson.topic_id == t.id).count()
        problem_count = db.query(Problem).filter(Problem.topic_id == t.id).count()
        result.append({
            "id":            t.id,
            "name":          t.name,
            "description":   t.description or "",
            "lesson_count":  lesson_count,
            "problem_count": problem_count,
        })

    return result


# ─── Delete ──────────────────────────────────────────────────────────────────

@router.delete("/{resource_id}", status_code=204, summary="Permanently delete a resource and its MinIO object")
def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a resource record and its MinIO object."""
    import re
    if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', resource_id, re.I):
        raise HTTPException(status_code=422, detail="Invalid resource_id format (UUID expected).")

    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found or not owned by current user.")

    # Delete from MinIO
    if resource.file_path and resource.file_path.strip():
        try:
            from app.storage.minio_client import _client
            _client().remove_object(settings.MINIO_BUCKET_NAME, resource.file_path)
            logger.info(f"[MinIO] Deleted: {resource.file_path}")
        except Exception as exc:
            logger.warning(f"[MinIO] Could not delete object (continuing): {exc}")

    db.delete(resource)
    db.commit()


# ─── Add link resource ────────────────────────────────────────────────────────

@router.post("/link", status_code=201, response_model=LinkResourceOut, summary="Add a YouTube, Google Drive, or web URL as a resource")
def add_resource_link(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    source_url: str = Form(...),
    link_type: str = Form("link"),
    week_name: Optional[str] = Form(None),
    class_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a URL resource. Supported types:
    - YouTube  → transcribed via Whisper, then AI extraction
    - Google Drive / direct PDF URL → downloaded, then AI extraction
    - Generic web URL → scraped and AI extracted
    Processing runs in the background. Poll `GET /{resource_id}/result` for status.
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Only instructors can add resource links.")
    if not source_url or not source_url.strip():
        raise HTTPException(status_code=422, detail="source_url cannot be empty.")
    if not title or not title.strip():
        raise HTTPException(status_code=422, detail="title cannot be empty.")
    if not source_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Enter a valid URL starting with http:// or https://")

    resource_id = str(uuid.uuid4())
    url_type    = detect_url_type(source_url)

    if url_type == "youtube":
        resolved_type = "video"
    elif url_type in ("direct_pdf", "google_drive"):
        resolved_type = "pdf"
    else:
        resolved_type = link_type

    resource = CourseResource(
        id=resource_id,
        instructor_id=current_user.id,
        filename=title,
        file_path="",
        file_type=resolved_type,
        week_name=week_name,
        source_url=source_url,
        status="processing",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()

    background_tasks.add_task(
        _process_link_task,
        resource_id=resource_id,
        source_url=source_url,
        week_name=week_name,
        class_id=class_id,
    )

    logger.info(f"Link added and processing started: {title} → {source_url} [{url_type}]")

    return {
        "resource_id": resource_id,
        "title":       title,
        "source_url":  source_url,
        "link_type":   resolved_type,
        "status":      "processing",
        "message":     "Link received, content extraction in progress. Poll /resources/{id}/result for status.",
    }


# ─── Download ─────────────────────────────────────────────────────────────────

@router.get("/{resource_id}/download", summary="Download a resource file or redirect to its external URL")
def download_resource(
    resource_id: str,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Auth: Authorization header OR ?token= query param.
    - file_path (MinIO key) → presigned redirect
    - source_url → 302 redirect (YouTube, Drive, web)
    """
    from fastapi.responses import RedirectResponse
    from app.core.security import decode_token
    from app.db.models import User as UserModel

    user = current_user
    if user is None and token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = db.query(UserModel).filter(UserModel.id == user_id).first()
        except Exception:
            pass

    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    # External link → redirect
    if resource.source_url and not (resource.file_path and resource.file_path.strip()):
        return RedirectResponse(url=resource.source_url, status_code=302)

    # MinIO object → presigned URL redirect
    if resource.file_path and resource.file_path.strip():
        try:
            if object_exists(resource.file_path):
                presigned = get_presigned_url(resource.file_path, expires_hours=2)
                logger.info(f"[MinIO] Presigned URL generated for {resource_id}")
                return RedirectResponse(url=presigned, status_code=302)
        except Exception as exc:
            logger.error(f"[MinIO] Presigned URL failed: {exc}")
            raise HTTPException(status_code=500, detail="Could not generate download URL.")

    raise HTTPException(status_code=404, detail="No file or link associated with this resource.")


# ─── Get extracted content ────────────────────────────────────────────────────

@router.get("/{resource_id}/content", response_model=ResourceContentOut, summary="Get AI-extracted structured content from a resource")
def get_resource_content(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """{ course_title, topics: [{name, description, lessons, questions}], misconceptions }"""
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    extraction = (
        db.query(AiExtractedContent)
        .filter(AiExtractedContent.resource_id == resource_id)
        .order_by(AiExtractedContent.created_at.desc())
        .first()
    )
    if not extraction:
        return {"course_title": "", "topics": [], "misconceptions": []}

    return extraction.extracted_json


# ─── Background tasks ─────────────────────────────────────────────────────────

def _process_resource_task(
    resource_id: str,
    minio_key: str,
    filename: str,
    week_name: Optional[str] = None,
    class_id: Optional[str] = None,
    instructor_prompt: str = "",
) -> None:
    """
    Background task: fetch file bytes from MinIO, run AI extraction, persist results.
    Runs in a separate thread; creates its own DB session.
    """
    from app.db.session import SessionLocal
    from app.ai.content_extractor import extract_content_from_markdown, make_llm_client
    from app.storage.minio_client import _client
    import io

    db = SessionLocal()
    try:
        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if not resource:
            logger.error(f"[{resource_id}] Resource not found in DB.")
            return

        logger.info(f"[{resource_id}] Fetching from MinIO: {minio_key}")

        # Stream bytes from MinIO
        response = _client().get_object(settings.MINIO_BUCKET_NAME, minio_key)
        file_bytes = response.read()
        response.close()
        response.release_conn()

        logger.info(f"[{resource_id}] Fetched {len(file_bytes)} bytes, starting text extraction…")

        markdown_text = extract_text_from_bytes(file_bytes, filename)

        resource.raw_markdown = markdown_text
        resource.updated_at   = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"[{resource_id}] LLM extraction starting…")

        llm_client = make_llm_client()
        result = extract_content_from_markdown(
            markdown_text=markdown_text,
            resource_id=resource_id,
            db=db,
            openai_client=llm_client,
            week_name=week_name,
            class_id=class_id,
            instructor_prompt=instructor_prompt,
        )

        resource.status        = "done"
        resource.error_message = None
        resource.updated_at    = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            f"[{resource_id}] DONE: "
            f"{result['topics_created']} topics, "
            f"{result['lessons_created']} lessons, "
            f"{result['problems_created']} problems"
        )

    except Exception as e:
        logger.exception(f"[{resource_id}] Processing error: {e}")
        try:
            resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
            if resource:
                resource.status        = "failed"
                resource.error_message = str(e)
                resource.updated_at    = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _process_link_task(
    resource_id: str,
    source_url: str,
    week_name: Optional[str] = None,
    class_id: Optional[str] = None,
) -> None:
    """Background task: extract text content from a URL and run AI extraction."""
    from app.db.session import SessionLocal
    from openai import OpenAI

    db = SessionLocal()
    client = OpenAI()

    try:
        logger.info(f"[{resource_id}] Processing link: {source_url}")

        text = extract_text_from_link(source_url, client)

        logger.info(f"[{resource_id}] Text extracted ({len(text)} chars), starting AI extraction…")

        extract_content_from_markdown(
            markdown_text=text,
            resource_id=resource_id,
            db=db,
            openai_client=client,
            week_name=week_name,
            class_id=class_id,
        )

        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if resource:
            resource.status       = "done"
            resource.raw_markdown = text[:10000]
            resource.updated_at   = datetime.now(timezone.utc)
            db.commit()

        logger.info(f"[{resource_id}] Link processing complete.")

    except Exception as exc:
        logger.error(f"[{resource_id}] Link processing error: {exc}")
        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if resource:
            resource.status        = "failed"
            resource.error_message = str(exc)[:500]
            resource.updated_at    = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
