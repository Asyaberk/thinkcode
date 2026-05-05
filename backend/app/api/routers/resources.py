"""

Router: /api/v1/resources

"""

import os

import uuid

import shutil

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["resources"])

# Yuklenen dosyalarin saklanacagi klasor

# Uretimde bu S3/GCS gibi bir object storage'a donusturulmeli

UPLOAD_DIR = Path("uploads/resources")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {

    # Belgeler

    ".pdf",

    ".png", ".jpg", ".jpeg",

    ".cpp", ".h", ".c", ".cc",

    ".py", ".js", ".ts", ".java",

    # Metin

    ".txt", ".md",

}

MAX_FILE_SIZE_MB = 10

@router.post("/upload", response_model=UploadResponseOut, summary="Upload a course resource file (PDF, image, code, text)")
async def upload_resource(

    file: UploadFile = File(...),

    week_name: Optional[str] = Form(None),

    class_id: Optional[str] = Form(None),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """
    Upload a file and store it. Call `POST /{resource_id}/process` afterwards to trigger AI extraction.
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

    # Benzersiz dosya adi olustur (cakisma onlemek icin UUID on eki)

    resource_id = str(uuid.uuid4())

    safe_filename = f"{resource_id}{suffix}"

    file_path = UPLOAD_DIR / safe_filename

    # Dosyayi diske kaydet

    with open(file_path, "wb") as f:

        f.write(file_bytes)

    logger.info(f"Dosya yuklendi: {file.filename} ({len(file_bytes)} byte) → {file_path}")

    # DB kaydini olustur

    resource = CourseResource(

        id=resource_id,

        instructor_id=current_user.id,

        class_id=class_id,              # Hangi derse ait (None ise set edilmedi)

        filename=file.filename or safe_filename,

        file_path=str(file_path),

        file_type=suffix.lstrip("."),

        week_name=week_name,

        status="uploaded",

        created_at=datetime.now(timezone.utc),

        updated_at=datetime.now(timezone.utc),

    )

    db.add(resource)

    db.commit()

    db.refresh(resource)

    try:

        from app.storage.minio_client import upload_file as minio_upload, make_object_key, get_content_type

        minio_key = make_object_key(resource_id, safe_filename)

        ct = get_content_type(safe_filename)

        minio_upload(str(file_path), minio_key, ct)

        logger.info(f"[MinIO] Uploaded: {minio_key}")

    except Exception as exc:

        logger.warning(f"[MinIO] Upload failed, using local fallback: {exc}")

    return {

        "resource_id": resource.id,

        "filename": resource.filename,

        "status": resource.status,

        "message": "File uploaded successfully. Use /process to trigger AI content extraction.",

    }

@router.post("/{resource_id}/process", summary="Trigger AI extraction for an uploaded resource")
def process_resource(

    resource_id: str,

    background_tasks: BackgroundTasks,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

    class_id: Optional[str] = None,

):

    """
    Trigger AI processing of an uploaded resource in the background:
    1. Text is extracted from the file (PDF, code, etc.)
    2. GPT extracts Topics / Lessons / Problems from the content
    3. Results are persisted to the database

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

    # Status'u 'processing' yap

    resource.status = "processing"

    if class_id and not resource.class_id:   # Yoksa ata (upload'dan kalmamissa)

        resource.class_id = class_id

    resource.updated_at = datetime.now(timezone.utc)

    db.commit()

    # Arka planda isle (kullaniciyi bekletme)

    background_tasks.add_task(

        _process_resource_task,

        resource_id=resource_id,

        file_path=resource.file_path,

        week_name=resource.week_name,

        class_id=class_id,

    )

    return {

        "resource_id": resource_id,

        "status": "processing",

        "message": "Processing started. Poll /resources/{id}/result for status.",

    }

@router.get("/{resource_id}/result", response_model=ResourceResultOut, summary="Poll processing status of an uploaded resource")
def get_resource_result(

    resource_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """
    Returns the current processing status and extracted content counts for a resource.
    Poll until `status` is `'done'` or `'failed'`.
    """

    resource = db.query(CourseResource).filter(

        CourseResource.id == resource_id,

        CourseResource.instructor_id == current_user.id,

    ).first()

    if not resource:

        raise HTTPException(status_code=404, detail="Resource not found.")

    # En son extraction kaydini getir

    extraction = (

        db.query(AiExtractedContent)

        .filter(AiExtractedContent.resource_id == resource_id)

        .order_by(AiExtractedContent.created_at.desc())

        .first()

    )

    return {

        "resource_id": resource_id,

        "filename": resource.filename,

        "status": resource.status,

        "error_message": resource.error_message,

        "topics_created":   extraction.topics_created   if extraction else 0,

        "lessons_created":  extraction.lessons_created  if extraction else 0,

        "problems_created": extraction.problems_created if extraction else 0,

        "created_at": resource.created_at,

        "updated_at": resource.updated_at,

    }

@router.get("/", response_model=list[ResourceListItemOut], summary="List all resources for the instructor")
def list_resources(

    class_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all resources uploaded by the instructor. Optionally filter by class_id."""
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Instructor access required.")

    q = (

        db.query(CourseResource)

        .filter(CourseResource.instructor_id == current_user.id)

    )

    if class_id:

        q = q.filter(CourseResource.class_id == class_id)

    resources = q.order_by(

        CourseResource.week_name.nullslast(),

        CourseResource.created_at.desc()

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

@router.delete("/{resource_id}", status_code=204, summary="Permanently delete a resource and its MinIO object")
def delete_resource(

    resource_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Permanently delete a resource and its associated object from MinIO storage."""

    # UUID format validation

    import re

    if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', resource_id, re.I):

        raise HTTPException(status_code=422, detail="Invalid resource_id format (UUID expected).")

    resource = db.query(CourseResource).filter(

        CourseResource.id == resource_id,

        CourseResource.instructor_id == current_user.id,

    ).first()

    if not resource:

        raise HTTPException(status_code=404, detail="Resource not found or not owned by current user.")

    # MinIO'dan sil

    if resource.file_path and resource.file_path.strip():

        try:

            from app.storage.minio_client import make_object_key, _client

            from pathlib import Path as _Path

            from app.core.config import settings as _s

            minio_key = make_object_key(resource.id, _Path(resource.file_path).name)

            _client().remove_object(_s.MINIO_BUCKET_NAME, minio_key)

            logger.info(f"[MinIO] Silindi: {minio_key}")

        except Exception as exc:

            logger.warning(f"[MinIO] Silinemedi (devam ediliyor): {exc}")

        # Lokal diskten sil

        try:

            if os.path.exists(resource.file_path):

                os.remove(resource.file_path)

                logger.info(f"[Disk] Silindi: {resource.file_path}")

        except Exception as exc:

            logger.warning(f"[Disk] Silinemedi: {exc}")

    db.delete(resource)

    db.commit()

    # 204 No Content

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

    url_type = detect_url_type(source_url)

    if url_type == "youtube":

        resolved_type = "video"

    elif url_type in ("direct_pdf", "google_drive"):

        resolved_type = "pdf"

    else:

        resolved_type = link_type   # Form'dan gelen

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

        "title": title,

        "source_url": source_url,

        "link_type": resolved_type,

        "status": "processing",

        "message": "Link received, content extraction in progress. Poll /resources/{id}/result for status.",

    }

def _process_link_task(

    resource_id: str,

    source_url: str,

    week_name: Optional[str] = None,

    class_id: Optional[str] = None,

) -> None:

    """
    Background task: extract text content from a URL, persist it to MinIO,
    and update the resource record with the extracted text.

    Supports YouTube, Google Drive PDF, direct PDF links, and general web pages.
    """

    from app.db.session import SessionLocal

    from openai import OpenAI

    db = SessionLocal()

    client = OpenAI()

    try:

        logger.info(f"Processing link: {source_url}")

        text = extract_text_from_link(source_url, client)

        logger.info(f"Text extracted ({len(text)} chars), starting AI extraction...")

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

            resource.status = "done"

            resource.raw_markdown = text[:10000]  # ilk 10K karakter sakla

            resource.updated_at = datetime.now(timezone.utc)

            db.commit()

        logger.info(f"Link processing complete: {resource_id}")

    except Exception as exc:

        logger.error(f"Link processing error ({resource_id}): {exc}")

        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()

        if resource:

            resource.status = "failed"

            resource.error_message = str(exc)[:500]

            resource.updated_at = datetime.now(timezone.utc)

            db.commit()

    finally:

        db.close()

@router.get("/{resource_id}/content", response_model=ResourceContentOut, summary="Get AI-extracted structured content from a resource")
def get_resource_content(

    resource_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

      { course_title, topics: [{name, description, lessons, questions}], misconceptions }

    """

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

@router.get("/{resource_id}/download", summary="Download a resource file or redirect to its external URL")
def download_resource(

    resource_id: str,

    token: Optional[str] = None,

    db: Session = Depends(get_db),

    current_user: Optional[User] = Depends(get_current_user_optional),

):

    """

    Auth: Authorization header VEYA ?token= query param

    - file_path dolu ise → FileResponse (PDF inline)

    - source_url dolu ise → 302 redirect (YouTube, Drive, web)

    """

    from fastapi.responses import FileResponse, RedirectResponse

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

    # Harici link (YouTube, Drive) → direkt redirect

    if resource.source_url and not (resource.file_path and resource.file_path.strip()):

        return RedirectResponse(url=resource.source_url, status_code=302)

    # PDF / dosya → MinIO'dan presigned URL dene, yoksa lokal fallback

    if resource.file_path and resource.file_path.strip():

        try:

            from app.storage.minio_client import make_object_key, get_presigned_url, object_exists

            from pathlib import Path as _Path

            minio_key = make_object_key(resource.id, _Path(resource.file_path).name)

            if object_exists(minio_key):

                presigned = get_presigned_url(minio_key, expires_hours=2)

                logger.info(f"[MinIO] Presigned URL → {resource.id}")

                return RedirectResponse(url=presigned, status_code=302)

        except Exception as exc:

            logger.warning(f"[MinIO] Could not generate presigned URL, using local fallback: {exc}")

        if os.path.exists(resource.file_path):

            media_type = "application/pdf" if resource.file_type == "pdf" else "application/octet-stream"

            return FileResponse(

                path=resource.file_path,

                media_type=media_type,

                filename=resource.filename,

                headers={"Content-Disposition": f'inline; filename="{resource.filename}"'},

            )

        raise HTTPException(status_code=404, detail="File not found in MinIO or on disk.")

    raise HTTPException(status_code=404, detail="No file or link associated with this resource.")

# ─── Arka plan gorevi ────────────────────────────────────────────────────────

def _process_resource_task(resource_id: str, file_path: str, week_name: Optional[str] = None, class_id: Optional[str] = None):

    """

    Arka planda calistirilan islem gorevi.

    BackgroundTasks tarafindan cagirilir; kendi DB oturumunu olusturur.

    Hata olursa status='failed' ve error_message yazilir.

    """

    # Arka plan gorevinde yeni bir DB oturumu acmamiz gerekiyor

    from app.db.session import SessionLocal

    from openai import OpenAI

    db = SessionLocal()

    try:

        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()

        if not resource:

            logger.error(f"Arka plan gorevi: kaynak bulunamadi: {resource_id}")

            return

        logger.info(f"[{resource_id}] Processing file: {file_path}")

        with open(file_path, "rb") as f:

            file_bytes = f.read()

        markdown_text = extract_text_from_bytes(file_bytes, resource.filename)

        # raw_markdown'i DB'ye kaydet

        resource.raw_markdown = markdown_text

        resource.updated_at = datetime.now(timezone.utc)

        db.commit()

        # ADIM 2: Markdown → Topics/Lessons/Problems (GPT)

        logger.info(f"[{resource_id}] GPT extraction basliyor...")

        openai_client = OpenAI()

        result = extract_content_from_markdown(

            markdown_text=markdown_text,

            resource_id=resource_id,

            db=db,

            openai_client=openai_client,

            week_name=week_name,

            class_id=class_id,

        )

        # Basarili: status = done

        resource.status = "done"

        resource.error_message = None

        resource.updated_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(

            f"[{resource_id}] TAMAMLANDI: "

            f"{result['topics_created']} topic, "

            f"{result['lessons_created']} lesson, "

            f"{result['problems_created']} problem"

        )

    except Exception as e:

        # Hata: status = failed, mesaji kaydet

        logger.exception(f"[{resource_id}] Islem hatasi: {e}")

        try:

            resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()

            if resource:

                resource.status = "failed"

                resource.error_message = str(e)

                resource.updated_at = datetime.now(timezone.utc)

                db.commit()

        except Exception:

            pass

    finally:

        db.close()

