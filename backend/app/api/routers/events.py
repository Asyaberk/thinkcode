"""
Router: /api/v1/events
Append-only learning event tracker
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import LearningEvent, User
from app.schemas import EventCreate

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", status_code=204)
def track_event(
    body: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = LearningEvent(
        student_id=current_user.id,
        class_id=body.class_id,
        topic_id=body.topic_id,
        lesson_id=body.lesson_id,
        problem_id=body.problem_id,
        material_id=body.material_id,
        event_type=body.event_type,
        event_metadata=body.event_metadata,
        duration_seconds=body.duration_seconds,
    )
    db.add(event)
    db.commit()
    return None
