"""
run_all.py — Master seed script.
Run from the backend/ directory:
    cd backend
    python -m scripts.seed.run_all
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import SessionLocal
from scripts.seed.topics import seed_topics
from scripts.seed.lessons import seed_lessons
from scripts.seed.problems import seed_problems
from scripts.seed.users import seed_users, seed_class_and_enrollments


def run():
    db = SessionLocal()
    try:
        print("\n🌱 ThinkCode — Database Seed")
        print("=" * 45)

        print("\n[1/5] Seeding topics...")
        topic_map = seed_topics(db)

        print("\n[2/5] Seeding lessons & materials...")
        lesson_map = seed_lessons(db, topic_map)

        print("\n[3/5] Seeding problems (with hints & test cases)...")
        seed_problems(db, topic_map, lesson_map)

        print("\n[4/5] Seeding users...")
        instructor, students = seed_users(db)

        print("\n[5/5] Seeding class & enrollments...")
        seed_class_and_enrollments(db, instructor, students)

        db.commit()
        print("\n✅ All seed data committed successfully!")
        print(f"   Instructor login: instructor@thinkcode.edu / Instructor123!")
        print(f"   Student login:    <first>.<last>@thinkcode.edu / Student123!")
        print("=" * 45)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
