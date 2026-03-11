"""
Router: /api/v1/analytics
Student & class-level learning analytics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, get_current_user
from app.db.models import (
    User, Submission, Problem, StudentTopicMastery, Topic, Class, Enrollment
)
from app.schemas import (
    StudentDashboardOut, MasteryOut, UserOut
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _mastery_out(mastery: StudentTopicMastery, topic: Topic) -> MasteryOut:
    return MasteryOut(
        topic_id=topic.id,
        topic_name=topic.name,
        mastery_score=mastery.mastery_score,
        problems_attempted=mastery.problems_attempted,
        problems_passed=mastery.problems_passed,
        total_hints_used=mastery.total_hints_used,
    )


@router.get("/me/dashboard", response_model=StudentDashboardOut)
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get first active enrollment's class_id
    enrollment = (
        db.query(Enrollment)
        .filter_by(student_id=current_user.id, status="active")
        .first()
    )
    class_id = enrollment.class_id if enrollment else None

    # All submissions
    subs = db.query(Submission).filter_by(student_id=current_user.id).all()
    total_attempted = len(subs)
    total_passed = sum(1 for s in subs if s.is_correct)

    # Mastery per topic
    mastery_records = (
        db.query(StudentTopicMastery)
        .filter_by(student_id=current_user.id)
        .all()
    )

    all_mastery = []
    for m in mastery_records:
        topic = db.get(Topic, m.topic_id)
        if topic:
            all_mastery.append(_mastery_out(m, topic))

    weak_topics = sorted(all_mastery, key=lambda x: x.mastery_score)[:3]
    recent_mastery = sorted(all_mastery, key=lambda x: x.mastery_score, reverse=True)[:5]

    # Overall score as average mastery
    overall = (
        sum(m.mastery_score for m in all_mastery) / len(all_mastery)
        if all_mastery else 0.0
    )

    # Percentile — compare to class peers
    if class_id:
        class_scores = (
            db.query(func.avg(StudentTopicMastery.mastery_score))
            .filter(StudentTopicMastery.class_id == class_id)
            .group_by(StudentTopicMastery.student_id)
            .all()
        )
        scores = [float(r[0]) for r in class_scores if r[0] is not None]
        below = sum(1 for s in scores if s < overall)
        percentile = round((below / len(scores)) * 100, 1) if scores else 50.0
    else:
        percentile = 50.0

    return StudentDashboardOut(
        user=UserOut.model_validate(current_user),
        total_problems_attempted=total_attempted,
        total_problems_passed=total_passed,
        overall_score=round(overall, 2),
        percentile=percentile,
        weak_topics=weak_topics,
        recent_mastery=recent_mastery,
    )


@router.get("/me/mastery", response_model=list[MasteryOut])
def my_mastery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(StudentTopicMastery)
        .filter_by(student_id=current_user.id)
        .all()
    )
    result = []
    for m in records:
        topic = db.get(Topic, m.topic_id)
        if topic:
            result.append(_mastery_out(m, topic))
    return result


@router.get("/students/{student_id}/mastery", response_model=list[MasteryOut])
def student_mastery(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Students can only see their own; instructors see anyone
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(403, "Access denied")

    records = db.query(StudentTopicMastery).filter_by(student_id=student_id).all()
    result = []
    for m in records:
        topic = db.get(Topic, m.topic_id)
        if topic:
            result.append(_mastery_out(m, topic))
    return result


@router.get("/me/submissions")
def my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subs = (
        db.query(Submission)
        .filter_by(student_id=current_user.id)
        .order_by(Submission.submitted_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": s.id,
            "problem_id": s.problem_id,
            "status": s.status,
            "score": s.score,
            "is_correct": s.is_correct,
            "attempt_number": s.attempt_number,
            "submitted_at": s.submitted_at,
        }
        for s in subs
    ]
