"""
Router: /api/v1/instructor
Instructor-facing analytics — Phase 3 (optimized SQL queries)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, require_instructor
from app.db.models import User, Class, Enrollment
from app.analytics.queries import (
    get_class_student_ranking,
    get_class_topic_heatmap,
    detect_knowledge_gaps,
    get_hint_analytics,
)

router = APIRouter(prefix="/instructor", tags=["instructor"])


@router.get("/{class_id}/dashboard")
def class_dashboard(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    if cls.instructor_id != instructor.id and instructor.role != "admin":
        raise HTTPException(403, "Not your class")

    total_students = (
        db.query(func.count(Enrollment.id))
        .filter_by(class_id=class_id, status="active")
        .scalar() or 0
    )

    # Student ranking (window function in SQL)
    ranking = get_class_student_ranking(db, class_id)

    # Class averages from ranking
    scores = [float(r["avg_mastery"]) for r in ranking]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    # Median
    sorted_s = sorted(scores)
    n = len(sorted_s)
    median_score = round(
        (sorted_s[n // 2] + sorted_s[~(n // 2)]) / 2, 2
    ) if n else 0.0

    # Topic heatmap
    heatmap = get_class_topic_heatmap(db, class_id)

    # Knowledge gaps
    gaps = detect_knowledge_gaps(db, class_id)

    return {
        "class_id": class_id,
        "class_name": cls.name,
        "class_code": cls.code,
        "total_students": total_students,
        "average_mastery": avg_score,
        "median_mastery": median_score,
        "students_with_activity": len([r for r in ranking if r["total_attempted"] > 0]),
        "knowledge_gaps": gaps[:5],      # top 5 worst gaps
        "topic_heatmap": heatmap,
        "top_students": ranking[:5],     # top 5
        "bottom_students": ranking[-5:][::-1] if len(ranking) >= 5 else ranking,
    }


@router.get("/{class_id}/students")
def class_students(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    return get_class_student_ranking(db, class_id)


@router.get("/{class_id}/topic-heatmap")
def topic_heatmap(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    """
    Per-topic class mastery for a heatmap chart.
    Each row: topic_name, avg_mastery, class_pass_rate, avg_hints_per_student.
    """
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    return get_class_topic_heatmap(db, class_id)


@router.get("/{class_id}/knowledge-gaps")
def knowledge_gaps(
    class_id: str,
    min_attempts: int = Query(3, ge=1, le=50),
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    """
    Problems with failure rate > 40%, ranked worst first.
    Includes avg time, unique students, hint usage.
    """
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    return detect_knowledge_gaps(db, class_id, min_attempts=min_attempts)


@router.post("/{class_id}/analyze-gaps")
def analyze_and_persist_gaps(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    """
    Detect knowledge gaps and persist them. Uses AI to summarize class weaknesses.
    """
    from app.db.models import KnowledgeGap
    from app.ai.gap_analysis import analyze_class_gaps_sync
    
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")

    gaps = detect_knowledge_gaps(db, class_id)
    new_gap_count = 0
    
    ai_summary = None
    if gaps:
        ai_summary = analyze_class_gaps_sync(class_name=cls.name, gaps_data=gaps)

    for g in gaps:
        existing = (
            db.query(KnowledgeGap)
            .filter_by(class_id=class_id, problem_id=g["problem_id"])
            .first()
        )
        rate = float(g["failure_rate_pct"]) / 100.0

        if existing:
            existing.failure_rate  = round(rate, 4)
            existing.student_count = int(g["unique_students"])
            existing.failure_count = int(g["failures"])
            existing.ai_analysis   = ai_summary
        else:
            db.add(KnowledgeGap(
                class_id=class_id,
                topic_id=g["topic_id"],
                problem_id=g["problem_id"],
                failure_rate=round(rate, 4),
                student_count=int(g["unique_students"]),
                failure_count=int(g["failures"]),
                ai_analysis=ai_summary
            ))
            new_gap_count += 1

    db.commit()
    return {
        "gaps_detected": len(gaps),
        "new_gaps_persisted": new_gap_count,
        "ai_analysis": ai_summary,
        "top_gap": gaps[0] if gaps else None,
    }


@router.get("/{class_id}/hints")
def hint_analytics(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    """
    Hint usage analytics: which levels are most used, which problems cause most hint requests.
    """
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    return get_hint_analytics(db, class_id)
