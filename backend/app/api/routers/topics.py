"""
Router: /api/v1/topics
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import Topic, Lesson
from app.schemas import TopicOut, LessonOut

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
def list_topics(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Topic).order_by(Topic.display_order).all()


@router.get("/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from fastapi import HTTPException
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")
    return topic


@router.get("/{topic_id}/lessons", response_model=list[LessonOut])
def topic_lessons(topic_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lessons = (
        db.query(Lesson)
        .filter(Lesson.topic_id == topic_id)
        .order_by(Lesson.display_order)
        .all()
    )
    return lessons
