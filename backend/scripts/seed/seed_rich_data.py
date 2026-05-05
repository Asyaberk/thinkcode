"""

Bu script:

  docker exec thinkcode-backend python /app/scripts/seed/seed_rich_data.py
"""

import sys
import random
import math
from datetime import datetime, timedelta
sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.db.models import (
    User, Class, Enrollment, Problem, Topic,
    Submission, StudentTopicMastery, ProblemOption
)

random.seed(42)

STUDENT_ABILITY_MU = 70.0
STUDENT_ABILITY_SIGMA = 15.0

DIFFICULTY_PENALTY = {
    "easy": 0.0,     # zorluk penalty yok
    "medium": 10.0,
    "hard": 20.0,
}

ATTEMPTS_RANGE = (2, 8)

def normal_clamp(mu: float, sigma: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Generate a normally distributed random number clamped to [lo, hi]."""
    return max(lo, min(hi, random.gauss(mu, sigma)))

def seed_submissions_and_mastery():
    """Ana seed fonksiyonu."""
    db = SessionLocal()
    try:
        print("\n🌱 Rich Data Seed — Submissions & Mastery")
        print("=" * 55)

        print("  → Clearing old submission and mastery records...")
        db.query(StudentTopicMastery).delete()
        db.query(Submission).delete()
        db.commit()

        cls = db.query(Class).filter_by(is_active=True).first()
        if not cls:
            print("  ❌ No active class found!")
            return
        print(f"  → Class: {cls.name} (ID: {cls.id})")

        enrolled_ids = [
            e.student_id for e in
            db.query(Enrollment).filter_by(class_id=cls.id, status="active").all()
        ]
        students = db.query(User).filter(
            User.id.in_(enrolled_ids),
            User.role == "student"
        ).all()
        print(f"  → {len(students)} students found")

        problems = db.query(Problem).all()
        print(f"  → {len(problems)} problem bulundu")

        correct_option_map: dict[str, str | None] = {}
        option_map: dict[str, list[str]] = {}
        all_opts = db.query(ProblemOption).all()
        for opt in all_opts:
            pid = str(opt.problem_id)
            option_map.setdefault(pid, []).append(str(opt.id))
            if opt.is_correct:
                correct_option_map[pid] = str(opt.id)

        # Topic → problem listesi indeksi
        topic_problems: dict[str, list[Problem]] = {}
        for prob in problems:
            key = str(prob.topic_id)
            topic_problems.setdefault(key, []).append(prob)

        student_ability: dict[str, float] = {}
        for s in students:
            student_ability[str(s.id)] = normal_clamp(
                STUDENT_ABILITY_MU, STUDENT_ABILITY_SIGMA, lo=35.0, hi=100.0
            )

        print("  → Generating submissions...")
        submission_count = 0
        started_at = datetime(2025, 9, 1)

        all_submissions: list[Submission] = []

        for student in students:
            sid = str(student.id)
            ability = student_ability[sid]

            n_problems = int(ability / 100 * len(problems) * 0.7) + random.randint(3, 8)
            n_problems = min(n_problems, len(problems))

            chosen_problems = random.sample(problems, n_problems)

            for prob in chosen_problems:
                n_attempts = random.randint(*ATTEMPTS_RANGE)
                penalty = DIFFICULTY_PENALTY.get(prob.difficulty, 10.0)

                all_options = option_map.get(str(prob.id), [])
                correct_opt = correct_option_map.get(str(prob.id))
                wrong_opts = [o for o in all_options if o != correct_opt]

                for attempt_num in range(1, n_attempts + 1):
                    learning_bonus = (attempt_num - 1) * 5.0
                    effective_ability = ability - penalty + learning_bonus
                    correct_prob = max(0.05, min(0.98, effective_ability / 100.0))
                    is_correct = random.random() < correct_prob

                    score = float(prob.points) if is_correct else 0.0
                    time_spent = int(normal_clamp(90, 60, 20, 600))  # saniye

                    days_offset = random.randint(0, 150)
                    sub_time = started_at + timedelta(days=days_offset, minutes=random.randint(0, 1440))

                    if is_correct:
                        sel_option = correct_opt
                    elif wrong_opts:
                        sel_option = random.choice(wrong_opts)
                    else:
                        sel_option = None

                    sub = Submission(
                        student_id=str(student.id),
                        problem_id=str(prob.id),
                        class_id=str(cls.id),
                        submitted_answer=f"answer_attempt_{attempt_num}",
                        selected_option_id=sel_option,
                        status="passed" if is_correct else "failed",
                        score=score,
                        max_score=float(prob.points),
                        is_correct=is_correct,
                        attempt_number=attempt_num,
                        time_spent_seconds=time_spent,
                        submitted_at=sub_time,
                    )
                    db.add(sub)
                    submission_count += 1

                if submission_count % 500 == 0:
                    db.flush()
                    print(f"    ... {submission_count} submission")

        db.commit()
        print(f"  ✓ {submission_count} submission eklendi")

        print("  → Computing topic mastery...")
        mastery_count = 0

        for student in students:
            sid = str(student.id)
            ability = student_ability[sid]

            for topic_id_str, t_problems in topic_problems.items():
                subs_for_topic = db.query(Submission).filter(
                    Submission.student_id == str(student.id),
                    Submission.class_id == str(cls.id),
                    Submission.problem_id.in_([str(p.id) for p in t_problems])
                ).all()

                if not subs_for_topic:
                    continue

                best_scores: dict[str, float] = {}
                for sub in subs_for_topic:
                    pid = str(sub.problem_id)
                    prob = next((p for p in t_problems if str(p.id) == pid), None)
                    if prob and prob.points > 0:
                        pct = float(sub.score) / float(prob.points) * 100.0
                        best_scores[pid] = max(best_scores.get(pid, 0.0), pct)

                if not best_scores:
                    continue

                mastery_score = sum(best_scores.values()) / len(best_scores)

                problems_attempted = len(set(str(s.problem_id) for s in subs_for_topic))
                problems_passed = len([v for v in best_scores.values() if v >= 70.0])
                hints_used = random.randint(0, problems_attempted * 2)

                # Son aktivite tarihi
                last_sub = max(subs_for_topic, key=lambda s: s.submitted_at)

                mastery = StudentTopicMastery(
                    student_id=str(student.id),
                    topic_id=topic_id_str,
                    class_id=str(cls.id),
                    mastery_score=round(mastery_score, 2),
                    problems_attempted=problems_attempted,
                    problems_passed=problems_passed,
                    total_hints_used=hints_used,
                    last_activity_at=last_sub.submitted_at,
                )
                db.add(mastery)
                mastery_count += 1

            if mastery_count % 200 == 0 and mastery_count > 0:
                db.flush()

        db.commit()
        print(f"  ✓ {mastery_count} mastery records added")

        final_subs = db.query(Submission).count()
        final_mastery = db.query(StudentTopicMastery).count()
        correct_subs = db.query(Submission).filter_by(is_correct=True).count()

        print("\n  📊 Summary:")
        print(f"    Toplam Submission: {final_subs}")
        print(f"    Correct Submissions: {correct_subs} ({100*correct_subs//max(final_subs,1)}%)")
        print(f"    Mastery Records:     {final_mastery}")
        print("=" * 55)
        print("✅ Rich data seed completed!")

    except Exception as e:
        db.rollback()
        print(f"❌ Hata: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_submissions_and_mastery()
