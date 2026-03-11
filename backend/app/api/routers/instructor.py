"""
Router: /api/v1/instructor
Instructor-facing analytics: class dashboard, student rankings, knowledge gaps
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from statistics import median

from app.api.deps import get_db, require_instructor
from app.db.models import (
    User, Class, Enrollment, Submission, Problem,
    StudentTopicMastery, KnowledgeGap, Topic
)
from app.schemas import (
    InstructorDashboardOut, KnowledgeGapOut, StudentRankOut
)

router = APIRouter(prefix="/instructor", tags=["instructor"])


def _build_student_rank(db: Session, class_id: str) -> list[StudentRankOut]:
    """Calculate per-student average mastery scores and derive percentiles."""
    records = (
        db.query(
            StudentTopicMastery.student_id,
            func.avg(StudentTopicMastery.mastery_score).label("avg_score"),
            func.count(StudentTopicMastery.topic_id).label("topics"),
            func.sum(StudentTopicMastery.problems_passed).label("problems_passed"),
        )
        .filter(StudentTopicMastery.class_id == class_id)
        .group_by(StudentTopicMastery.student_id)
        .all()
    )

    if not records:
        return []

    scores = [float(r.avg_score or 0) for r in records]
    sorted_scores = sorted(scores)

    result = []
    for r in records:
        score = float(r.avg_score or 0)
        below = sum(1 for s in sorted_scores if s < score)
        pct = round((below / len(sorted_scores)) * 100, 1) if sorted_scores else 50.0

        student = db.get(User, r.student_id)
        if student:
            result.append(StudentRankOut(
                student_id=r.student_id,
                first_name=student.first_name,
                last_name=student.last_name,
                total_score=round(score, 2),
                percentile=pct,
                problems_passed=int(r.problems_passed or 0),
            ))

    return sorted(result, key=lambda x: x.total_score, reverse=True)


@router.get("/{class_id}/dashboard", response_model=InstructorDashboardOut)
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
        .scalar()
    )

    # Average score per student (avg mastery across topics)
    student_avgs = (
        db.query(func.avg(StudentTopicMastery.mastery_score))
        .filter(StudentTopicMastery.class_id == class_id)
        .group_by(StudentTopicMastery.student_id)
        .all()
    )
    scores = [float(r[0]) for r in student_avgs if r[0] is not None]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    med_score = round(median(scores), 2) if scores else 0.0

    # Knowledge gaps
    gaps_raw = (
        db.query(KnowledgeGap)
        .filter_by(class_id=class_id)
        .order_by(KnowledgeGap.failure_rate.desc())
        .limit(10)
        .all()
    )
    gaps = []
    for g in gaps_raw:
        topic = db.get(Topic, g.topic_id)
        problem = db.get(Problem, g.problem_id) if g.problem_id else None
        gaps.append(KnowledgeGapOut(
            topic_id=g.topic_id,
            topic_name=topic.name if topic else "",
            problem_id=g.problem_id,
            problem_title=problem.title if problem else None,
            failure_rate=g.failure_rate,
            student_count=g.student_count,
            failure_count=g.failure_count,
        ))

    ranking = _build_student_rank(db, class_id)

    return InstructorDashboardOut(
        class_id=class_id,
        class_name=cls.name,
        total_students=total_students,
        average_score=avg_score,
        median_score=med_score,
        knowledge_gaps=gaps,
        student_ranking=ranking[:20],  # top 20
    )


@router.post("/{class_id}/analyze-gaps")
def analyze_gaps(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    """
    Recompute knowledge gaps for the class.
    Finds problems with failure_rate > 40% and upserts KnowledgeGap records.
    """
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")

    # Get all submissions grouped by problem
    results = (
        db.query(
            Submission.problem_id,
            func.count(Submission.id).label("total"),
            func.sum(
                func.cast(Submission.is_correct == False, func.Integer())
            ).label("failures"),
        )
        .filter(
            Submission.class_id == class_id,
            Submission.is_correct != None,
        )
        .group_by(Submission.problem_id)
        .having(func.count(Submission.id) >= 3)  # min 3 attempts
        .all()
    )

    created = 0
    for r in results:
        total = int(r.total)
        failures = int(r.failures or 0)
        failure_rate = failures / total

        if failure_rate < 0.4:
            continue

        problem = db.get(Problem, r.problem_id)
        if not problem:
            continue

        # Upsert
        gap = (
            db.query(KnowledgeGap)
            .filter_by(class_id=class_id, topic_id=problem.topic_id, problem_id=problem.id)
            .first()
        )
        if gap:
            gap.failure_rate = round(failure_rate, 4)
            gap.student_count = total
            gap.failure_count = failures
        else:
            db.add(KnowledgeGap(
                class_id=class_id,
                topic_id=problem.topic_id,
                problem_id=problem.id,
                failure_rate=round(failure_rate, 4),
                student_count=total,
                failure_count=failures,
            ))
            created += 1

    db.commit()
    return {"gaps_found": len(results), "new_gaps": created}


@router.get("/{class_id}/students")
def class_students(
    class_id: str,
    db: Session = Depends(get_db),
    instructor: User = Depends(require_instructor),
):
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")

    return _build_student_rank(db, class_id)
