"""
Router: /api/v1/lessons
Provides lesson content and content summarization agent triggering.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_instructor
from app.db.models import Lesson, User
from app.schemas import LessonOut

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
        # Fallback to the Princeton reference if available
        # Assume Princeton URLs usually have some format, or we just throw error
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
