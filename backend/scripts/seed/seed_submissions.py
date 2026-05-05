"""

    docker exec thinkcode-backend python -m scripts.seed.seed_submissions
"""
import sys
import os
import random
from datetime import datetime, timezone, timedelta

# Ensure the /app package root is on sys.path when running directly inside the container
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import SessionLocal
from app.db.models import User, Problem, Class, Enrollment, Submission, StudentTopicMastery

def seed_submissions(db):
    """
    Seed submission history for all enrolled students.

    Gives the demo user emma.johnson a perfect pass rate, then assigns
    each remaining student a random pass rate between 35% and 95%.
    Recomputes topic mastery for the class after seeding.
    """

    emma = db.query(User).filter_by(email="emma.johnson@thinkcode.edu").first()
    if not emma:
        print("  ⚠️  emma.johnson@thinkcode.edu not found, skipping seed.")
        return

    # Tek class: "Algorithms & Data Structures"
    cls = db.query(Class).first()
    if not cls:
        print("  ⚠️  No class found, skipping seed.")
        return

    problems = db.query(Problem).filter(Problem.is_published == True).all()
    if not problems:
        print("  ⚠️  No published problems — run run_all.py first.")
        return

    enrolled_ids = [
        e.student_id for e in
        db.query(Enrollment).filter_by(class_id=cls.id, status="active").all()
    ]
    students = db.query(User).filter(User.id.in_(enrolled_ids)).all()

    print(f"  → {len(students)} students, {len(problems)} problems found.")

    db.query(StudentTopicMastery).filter(
        StudentTopicMastery.class_id == cls.id
    ).delete(synchronize_session=False)
    db.query(Submission).filter(Submission.class_id == cls.id).delete(
        synchronize_session=False
    )
    db.flush()

    _seed_student_submissions(db, emma, cls, problems, pass_rate=0.74)

    for student in students:
        if student.id == emma.id:
            continue
        rate = random.uniform(0.35, 0.95)
        _seed_student_submissions(db, student, cls, problems, pass_rate=rate)

    _recompute_all_mastery(db, cls)

    print(f"  ✓ Submission seed complete.")

def _seed_student_submissions(db, student, cls, problems, pass_rate: float):
    """
    Generate simulated submission history for a single student.

    Randomly samples a subset of problems, creates 1-3 attempts per problem,
    and sets the final attempt's correctness according to pass_rate.
    """
    attempted = random.sample(problems, k=min(len(problems), random.randint(6, len(problems))))

    base_time = datetime.now(timezone.utc) - timedelta(days=30)

    for i, problem in enumerate(attempted):
        num_attempts = random.randint(1, 3)
        last_is_correct = random.random() < pass_rate

        for attempt_num in range(1, num_attempts + 1):
            is_correct = last_is_correct if attempt_num == num_attempts else (
                random.random() < pass_rate * 0.5
            )

            score = float(problem.points) if is_correct else 0.0
            status = "passed" if is_correct else "failed"

            selected_option_id = None
            if problem.type == "multiple_choice" and problem.options:
                if is_correct:
                    correct_opts = [o for o in problem.options if o.is_correct]
                    selected_option_id = correct_opts[0].id if correct_opts else None
                else:
                    wrong_opts = [o for o in problem.options if not o.is_correct]
                    selected_option_id = wrong_opts[0].id if wrong_opts else None

            sub = Submission(
                student_id=student.id,
                problem_id=problem.id,
                class_id=cls.id,
                submitted_code=(
                    "// sample code\n#include <iostream>\nint main(){return 0;}"
                    if problem.type == "coding" else None
                ),
                submitted_answer=(
                    "Sample answer text" if problem.type == "open_response" else None
                ),
                selected_option_id=selected_option_id,
                status=status,
                score=score,
                max_score=float(problem.points),
                is_correct=is_correct,
                attempt_number=attempt_num,
                time_spent_seconds=random.randint(120, 1800),   # 2-30 minutes
                submitted_at=base_time + timedelta(
                    hours=i * 6 + attempt_num * 2 + random.randint(0, 4)
                ),
            )
            db.add(sub)

    db.flush()

def _recompute_all_mastery(db, cls):
    """
    Recompute and upsert StudentTopicMastery for every student in the class.

    Uses the same latest-attempt, points-weighted formula as the live
    recompute_mastery() function in analytics/queries.py.
    """
    from sqlalchemy import func
    from app.db.models import Problem as ProblemModel

    rows = (
        db.query(
            Submission.student_id,
            ProblemModel.topic_id,
            func.count(Submission.id).label("attempted"),
            func.sum(
                # SQLAlchemy: True/False → 1/0
                func.cast(Submission.is_correct, db.bind.dialect.BOOLEAN if False else
                          __import__("sqlalchemy").Integer)
            ).label("passed"),
        )
        .join(ProblemModel, ProblemModel.id == Submission.problem_id)
        .filter(Submission.class_id == cls.id)
        .group_by(Submission.student_id, ProblemModel.topic_id)
        .all()
    )

    for row in rows:
        student_id, topic_id, attempted, passed_raw = row
        passed = int(passed_raw or 0)
        mastery = round((passed / attempted) * 100, 2) if attempted > 0 else 0.0

        existing = (
            db.query(StudentTopicMastery)
            .filter_by(student_id=student_id, topic_id=topic_id, class_id=cls.id)
            .first()
        )
        if existing:
            existing.problems_attempted = attempted
            existing.problems_passed = passed
            existing.mastery_score = mastery
            existing.last_activity_at = datetime.now(timezone.utc)
        else:
            db.add(StudentTopicMastery(
                student_id=student_id,
                topic_id=topic_id,
                class_id=cls.id,
                problems_attempted=attempted,
                problems_passed=passed,
                mastery_score=mastery,
                total_hints_used=random.randint(0, 5),
                last_activity_at=datetime.now(timezone.utc),
            ))

    db.flush()
    print(f"  ✓ {len(rows)} mastery records updated.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("\n🌱 Submission Seed Started")
        print("=" * 45)
        seed_submissions(db)
        db.commit()
        print("=" * 45)
        print("✅ Submission seed completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
