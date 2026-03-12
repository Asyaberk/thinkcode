"""
Router: /api/v1/analytics
Student & class-level learning analytics — Phase 3 (optimized SQL queries)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.db.models import User, Enrollment, Submission
from app.analytics.queries import (
    get_student_mastery_summary,
    get_class_percentile_rank,
    get_weekly_progress,
    get_topic_breakdown,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _get_class_id(db: Session, student_id: str) -> Optional[str]:
    """Get the first active enrollment's class_id for a student."""
    enrollment = (
        db.query(Enrollment)
        .filter_by(student_id=student_id, status="active")
        .first()
    )
    return enrollment.class_id if enrollment else None


# ─────────────────────────────────────────────────────────────────────────────
# Student Dashboard
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/dashboard")
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    class_id = _get_class_id(db, current_user.id)

    # Mastery summary — SQL aggregation, no loops
    mastery_rows = get_student_mastery_summary(db, current_user.id)

    # Percentile — window function
    percentile_data = {"percentile": 50.0, "rank": None, "total_students": 0, "avg_mastery": 0.0}
    if class_id:
        percentile_data = get_class_percentile_rank(db, current_user.id, class_id)

    # Derive overall score from mastery rows
    scored = [r for r in mastery_rows if r["problems_attempted"] > 0]
    overall = (
        sum(float(r["mastery_score"] or 0) for r in scored) / len(scored)
        if scored else 0.0
    )

    # Submission totals
    subs = db.query(Submission).filter_by(student_id=current_user.id).all()

    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "role": current_user.role,
        },
        "class_id": class_id,
        "total_problems_attempted": len(subs),
        "total_problems_passed": sum(1 for s in subs if s.is_correct),
        "overall_mastery_score": round(overall, 2),
        "percentile": float(percentile_data.get("percentile", 50.0)),
        "rank": percentile_data.get("rank"),
        "total_students_in_class": percentile_data.get("total_students", 0),
        # Weak topics = lowest mastery, attempted
        "weak_topics": sorted(
            [r for r in mastery_rows if int(r.get("problems_attempted") or 0) > 0],
            key=lambda x: float(x.get("mastery_score") or 0),
        )[:3],
        # Strong topics = highest mastery
        "strong_topics": sorted(
            [r for r in mastery_rows if int(r.get("problems_attempted") or 0) > 0],
            key=lambda x: float(x.get("mastery_score") or 0),
            reverse=True,
        )[:3],
        "all_topics": mastery_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Mastery List
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/mastery")
def my_mastery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_student_mastery_summary(db, current_user.id)


# ─────────────────────────────────────────────────────────────────────────────
# Per-topic breakdown with badge level + completion %
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/topic-breakdown")
def my_topic_breakdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    class_id = _get_class_id(db, current_user.id)
    if not class_id:
        raise HTTPException(404, "No active class enrollment found")
    return get_topic_breakdown(db, current_user.id, class_id)


# ─────────────────────────────────────────────────────────────────────────────
# Weekly progress (time series for charts)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/progress")
def my_progress(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_weekly_progress(db, current_user.id, days=days)


# ─────────────────────────────────────────────────────────────────────────────
# Any student's mastery (instructors can see any, students only themselves)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/students/{student_id}/mastery")
def student_mastery(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(403, "Access denied")
    return get_student_mastery_summary(db, student_id)


# ─────────────────────────────────────────────────────────────────────────────
# Recent submissions list
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/submissions")
def my_submissions(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subs = (
        db.query(Submission)
        .filter_by(student_id=current_user.id)
        .order_by(Submission.submitted_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "problem_id": s.problem_id,
            "status": s.status,
            "score": s.score,
            "max_score": s.max_score,
            "is_correct": s.is_correct,
            "attempt_number": s.attempt_number,
            "time_spent_seconds": s.time_spent_seconds,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        }
        for s in subs
    ]
