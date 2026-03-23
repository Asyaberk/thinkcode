"""
seed_submissions.py — Demo submission + mastery verisi oluşturur.
Bu script, dashboard'da NaN% görünmesini önlemek için Emma Johnson ve
diğer seed öğrencileri için gerçekçi submission'lar + mastery skorları üretir.

Çalıştırma:
    docker exec thinkcode-backend python -m scripts.seed.seed_submissions
"""
import sys
import os
import random
from datetime import datetime, timezone, timedelta

# Python yolu: /app/scripts/seed/ → /app olarak ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import SessionLocal
from app.db.models import User, Problem, Class, Enrollment, Submission, StudentTopicMastery


def seed_submissions(db):
    """
    Emma Johnson + diğer aktif öğrenciler için örnek submission'lar
    ve mastery skorları oluşturur.
    """

    # ── Temel verileri çek ─────────────────────────────────────────────────────

    # Demo öğrenci: Emma Johnson (login sayfasındaki demo button)
    emma = db.query(User).filter_by(email="emma.johnson@thinkcode.edu").first()
    if not emma:
        print("  ⚠️  emma.johnson@thinkcode.edu bulunamadı, seed atlanıyor.")
        return

    # Tek class: "Algorithms & Data Structures"
    cls = db.query(Class).first()
    if not cls:
        print("  ⚠️  Hiç class bulunamadı, seed atlanıyor.")
        return

    # Yayınlanmış tüm problemleri al
    problems = db.query(Problem).filter(Problem.is_published == True).all()
    if not problems:
        print("  ⚠️  Yayınlanmış problem yok, önce run_all.py çalıştırın.")
        return

    # Tüm aktif öğrencileri al
    enrolled_ids = [
        e.student_id for e in
        db.query(Enrollment).filter_by(class_id=cls.id, status="active").all()
    ]
    students = db.query(User).filter(User.id.in_(enrolled_ids)).all()

    print(f"  → {len(students)} öğrenci, {len(problems)} problem bulundu.")

    # ── Mevcut submission'ları temizle (idempotent çalışma) ────────────────────
    db.query(StudentTopicMastery).filter(
        StudentTopicMastery.class_id == cls.id
    ).delete(synchronize_session=False)
    db.query(Submission).filter(Submission.class_id == cls.id).delete(
        synchronize_session=False
    )
    db.flush()

    # ── Emma için gerçekçi submission'lar ─────────────────────────────────────
    _seed_student_submissions(db, emma, cls, problems, pass_rate=0.74)

    # ── Diğer öğrenciler için rastgele submission'lar ─────────────────────────
    for student in students:
        if student.id == emma.id:
            continue  # Emma zaten yapıldı
        # Tüm öğrenciler submission alsın — uygulama herkese çalışmalı
        rate = random.uniform(0.35, 0.95)   # %35-95 arası pass rate (çeşitlilik için)
        _seed_student_submissions(db, student, cls, problems, pass_rate=rate)


    # ── Mastery skorlarını yeniden hesapla ────────────────────────────────────
    _recompute_all_mastery(db, cls)

    print(f"  ✓ Submission seed tamamlandı.")


def _seed_student_submissions(db, student, cls, problems, pass_rate: float):
    """
    Tek bir öğrenci için submission'lar üretir.
    pass_rate: 0.0-1.0 arası — doğru cevaplama oranı
    """
    # Problemlerin rastgele bir alt kümesini seç (hepsini değil — gerçekçilik için)
    attempted = random.sample(problems, k=min(len(problems), random.randint(6, len(problems))))

    base_time = datetime.now(timezone.utc) - timedelta(days=30)

    for i, problem in enumerate(attempted):
        # Problem başına 1-3 deneme
        num_attempts = random.randint(1, 3)
        last_is_correct = random.random() < pass_rate   # son deneme pass rate'e göre

        for attempt_num in range(1, num_attempts + 1):
            # Son deneme pass rate'e göre, öncekiler biraz daha düşük
            is_correct = last_is_correct if attempt_num == num_attempts else (
                random.random() < pass_rate * 0.5
            )

            score = float(problem.points) if is_correct else 0.0
            status = "passed" if is_correct else "failed"

            # MCQ için option seçimi (basit: is_correct flag'ine göre)
            selected_option_id = None
            if problem.type == "multiple_choice" and problem.options:
                if is_correct:
                    # Doğru option'ı bul
                    correct_opts = [o for o in problem.options if o.is_correct]
                    selected_option_id = correct_opts[0].id if correct_opts else None
                else:
                    # Yanlış option seç
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
                time_spent_seconds=random.randint(120, 1800),   # 2-30 dakika
                # Zaman dağılımı: son 30 gün boyunca yayılsın
                submitted_at=base_time + timedelta(
                    hours=i * 6 + attempt_num * 2 + random.randint(0, 4)
                ),
            )
            db.add(sub)

    db.flush()


def _recompute_all_mastery(db, cls):
    """
    Tüm öğrenciler için topic bazlı mastery skorunu hesaplar ve DB'ye yazar.
    Formül: mastery = (problems_passed / problems_attempted) * 100
    """
    from sqlalchemy import func
    from app.db.models import Problem as ProblemModel

    # Her öğrenci + topic kombinasyonu için topla
    rows = (
        db.query(
            Submission.student_id,
            ProblemModel.topic_id,
            func.count(Submission.id).label("attempted"),
            func.sum(
                # SQLAlchemy: True/False → 1/0
                func.cast(Submission.is_correct, db.bind.dialect.BOOLEAN if False else
                          # PostgreSQL için doğrudan int cast
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

        # Upsert mastery kaydı
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
    print(f"  ✓ {len(rows)} mastery kaydı güncellendi.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("\n🌱 Submission Seed Başlatıldı")
        print("=" * 45)
        seed_submissions(db)
        db.commit()
        print("=" * 45)
        print("✅ Submission seed başarıyla tamamlandı!")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
