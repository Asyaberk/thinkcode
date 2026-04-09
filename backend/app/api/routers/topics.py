"""
Router: /api/v1/topics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_instructor
from app.db.models import Topic, Lesson
from app.schemas import TopicOut, LessonOut, TopicUpdate, TopicCreate, LessonCreate

router = APIRouter(prefix="/topics", tags=["topics"])


@router.post("", response_model=TopicOut, status_code=201)
def create_topic(
    body: TopicCreate,
    db: Session = Depends(get_db),
    _=Depends(require_instructor),
):
    """Instructor: manually creates a new topic."""
    import uuid
    max_order_row = db.query(Topic.display_order).order_by(Topic.display_order.desc()).first()
    next_order = (max_order_row[0] + 1) if max_order_row else 0
    topic = Topic(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        display_order=next_order,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


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


@router.post("/{topic_id}/lessons", response_model=LessonOut, status_code=201)
def create_lesson(
    topic_id: str,
    body: LessonCreate,
    db: Session = Depends(get_db),
    _=Depends(require_instructor),
):
    """Instructor: manually creates a new lesson under a topic."""
    import uuid
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")
    max_order_row = db.query(Lesson.display_order).filter(
        Lesson.topic_id == topic_id
    ).order_by(Lesson.display_order.desc()).first()
    next_order = (max_order_row[0] + 1) if max_order_row else 0
    lesson = Lesson(
        id=str(uuid.uuid4()),
        topic_id=topic_id,
        title=body.title,
        summary=body.summary,
        content_markdown=body.content_markdown,
        estimated_minutes=body.estimated_minutes or 15,
        display_order=next_order,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.patch("/{topic_id}", response_model=TopicOut)
def update_topic(
    topic_id: str,
    body: TopicUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_instructor),
):
    """Instructor: topic adını veya açıklamasını günceller."""
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")
    if body.name is not None:
        topic.name = body.name
    if body.description is not None:
        topic.description = body.description
    db.commit()
    db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=204)
def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_instructor),
):
    """Instructor: topic ve altındaki tüm lesson/problem'ları siler."""
    from app.db.models import Problem, ProblemOption, ProblemHint

    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")

    # Cascade: hints → options → problems → lessons → topic
    problem_ids = [p.id for p in db.query(Problem).filter(Problem.topic_id == topic_id).all()]
    if problem_ids:
        db.query(ProblemHint).filter(ProblemHint.problem_id.in_(problem_ids)).delete(synchronize_session=False)
        db.query(ProblemOption).filter(ProblemOption.problem_id.in_(problem_ids)).delete(synchronize_session=False)
        db.query(Problem).filter(Problem.topic_id == topic_id).delete(synchronize_session=False)
    db.query(Lesson).filter(Lesson.topic_id == topic_id).delete(synchronize_session=False)
    db.delete(topic)
    db.commit()
