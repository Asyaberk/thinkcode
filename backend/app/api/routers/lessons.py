"""
Router: /api/v1/lessons
Provides lesson content and content summarization agent triggering.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_instructor
from app.db.models import Lesson, User
from app.schemas import LessonOut, LessonUpdate

router = APIRouter(prefix="/lessons", tags=["lessons"])

@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: str, db: Session = Depends(get_db)):
    """Fetch a lesson and its materials."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    return lesson

@router.post("/{lesson_id}/generate-content")
def generate_lesson_content(
    lesson_id: str,
    source_url: str = None,
    raw_text: str = None,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor)
):
    """
    Uses the Content Summarization Agent to generate `summary` and `content_markdown`
    for the lesson, and updates the database.
    """
    from app.ai.content import generate_lesson_content_sync
    
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")
        
    if not source_url and not raw_text:
        raise HTTPException(400, "Must provide source_url or raw_text")
        
    result = generate_lesson_content_sync(source_url=source_url, raw_text=raw_text)
    
    if result["summary"] and "Could not parse" not in result["summary"]:
        lesson.summary = result["summary"]
    
    if result["markdown_content"]:
        lesson.content_markdown = result["markdown_content"]
        
    db.commit()
    return {
        "message": "Content generated successfully",
        "summary": result["summary"],
        "markdown_length": len(result["markdown_content"])
    }


@router.patch("/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: str,
    body: LessonUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_instructor),
):
    """Instructor: update lesson title, summary, content, or duration."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if body.title is not None:
        lesson.title = body.title
    if body.summary is not None:
        lesson.summary = body.summary
    if body.content_markdown is not None:
        lesson.content_markdown = body.content_markdown
    if body.estimated_minutes is not None:
        lesson.estimated_minutes = body.estimated_minutes
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_instructor),
):
    """Instructor: delete a lesson."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    db.delete(lesson)
    db.commit()
