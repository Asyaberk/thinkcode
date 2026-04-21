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
        class_id=body.class_id,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@router.get("")
def list_topics(
    class_id: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Sınıfa özgü konuları döner. class_id verilmezse tümünü döner (instructor)."""
    from sqlalchemy import or_

    q = db.query(Topic).order_by(Topic.display_order)
    if class_id:
        q = q.filter(Topic.class_id == class_id)

    all_topics = q.all()
    has_lesson   = {t.id for t in all_topics if t.lessons}
    has_problem  = {t.id for t in all_topics if any(p.is_published for p in t.problems)}
    has_children = {t.parent_topic_id for t in all_topics if t.parent_topic_id}

    def _keep(t: Topic) -> bool:
        if t.parent_topic_id:
            return True
        return t.id in has_lesson or t.id in has_problem or t.id in has_children

    filtered = [t for t in all_topics if _keep(t)]

    # lesson_count ve problem_count ile zenginleştir
    return [
        {
            "id":              t.id,
            "name":            t.name,
            "description":     t.description,
            "book_chapter":    t.book_chapter,
            "book_url":        t.book_url,
            "display_order":   t.display_order,
            "parent_topic_id": t.parent_topic_id,
            "lesson_count":    len(t.lessons),
            "problem_count":   len([p for p in t.problems if p.is_published]),
        }
        for t in filtered
    ]



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


@router.get("/{topic_id}/resources")
def get_topic_resources(
    topic_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Bir konuya bağlı kaynak materyallerini döner.
    Öğrenci LearningPage'de "Kaynağa Git" butonu için kullanılır.

    Döndürür:
      { resource_id, title, source_url, file_type, has_file, download_url }
    """
    from app.db.models import CourseResource

    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")

    if not topic.source_resource_id:
        return []   # Kaynak yok — manuel oluşturulmuş topic

    resource = db.get(CourseResource, topic.source_resource_id)
    if not resource:
        return []

    return [{
        "resource_id":   resource.id,
        "title":         resource.filename,
        "source_url":    resource.source_url,
        "file_type":     resource.file_type,
        "week_name":     resource.week_name,
        # Diskdeki PDF varsa download URL'si
        "has_file":      bool(resource.file_path and resource.file_path != ""),
        "download_url":  f"/api/v1/resources/{resource.id}/download" if resource.file_path else None,
    }]
