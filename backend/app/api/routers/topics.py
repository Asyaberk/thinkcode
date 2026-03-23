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
    from sqlalchemy import exists
    from app.db.models import Problem

    all_topics = db.query(Topic).order_by(Topic.display_order).all()

    # Her topic'in ID kumesini olustur
    all_ids = {t.id for t in all_topics}
    # Dersi olan topic'ler
    has_lesson = {t.id for t in all_topics if t.lessons}
    # Yayinlanmis problemi olan topic'ler
    has_problem = {t.id for t in all_topics if any(p.is_published for p in t.problems)}
    # Alt topic'i olan topic'ler (parent olanlar)
    has_children = {t.parent_topic_id for t in all_topics if t.parent_topic_id}

    def _keep(t: Topic) -> bool:
        # Alt konuysa (parent'i var) her zaman goster
        if t.parent_topic_id:
            return True
        # Ust konuysa: ya icerik var ya cocuk var
        return t.id in has_lesson or t.id in has_problem or t.id in has_children

    return [t for t in all_topics if _keep(t)]



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
