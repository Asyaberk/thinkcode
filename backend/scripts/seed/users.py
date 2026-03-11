"""
Seed: Users — 1 Instructor + 100 Students
"""
import random
import bcrypt
from app.db.models import User, Class, Enrollment

def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

FIRST_NAMES = [
    "Emma","Liam","Olivia","Noah","Ava","Elijah","Sophia","Oliver",
    "Isabella","James","Mia","Lucas","Charlotte","Ethan","Amelia",
    "Aiden","Harper","Mason","Evelyn","Logan","Abigail","Sebastian",
    "Ella","Mateo","Scarlett","Jack","Grace","Owen","Chloe","Theodore",
    "Victoria","Henry","Riley","Alexander","Aria","Daniel","Layla",
    "Michael","Penelope","Benjamin","Camila","Jackson","Luna","Samuel",
    "Gianna","David","Zoe","Joseph","Nora","Carter","Lily","Wyatt",
    "Hannah","John","Eleanor","Luke","Lillian","Gabriel","Addison",
    "Anthony","Aubrey","Isaac","Ellie","Dylan","Stella","Leo","Natalia",
    "Lincoln","Zoey","Jaxon","Leah","Asher","Hazel","Christopher","Violet",
    "Joshua","Aurora","Andrew","Savannah","Ryan","Audrey","Nathan","Brooklyn",
    "Thomas","Bella","Ezra","Claire","Hudson","Skylar","Aiden","Lucy",
    "Caleb","Paisley","Christian","Everly","Hunter","Anna","Connor","Caroline",
]

LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
    "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
    "Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson",
    "White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker",
    "Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
    "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell",
    "Carter","Roberts","Yılmaz","Kaya","Demir","Şahin","Çelik","Yıldız",
]


def seed_users(db) -> tuple:
    """Returns (instructor, students_list)."""
    # ── Instructor ───────────────────────────────────────────────
    instructor = User(
        email="instructor@thinkcode.edu",
        password_hash=_hash("Instructor123!"),
        first_name="Alice",
        last_name="Turing",
        role="instructor",
        is_active=True,
    )
    db.add(instructor)
    db.flush()

    # ── 100 Students ─────────────────────────────────────────────
    students = []
    used_emails = set()
    for i in range(100):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last  = random.choice(LAST_NAMES)
        base_email = f"{first.lower()}.{last.lower()}@thinkcode.edu"
        email = base_email
        suffix = 1
        while email in used_emails:
            email = f"{first.lower()}.{last.lower()}{suffix}@thinkcode.edu"
            suffix += 1
        used_emails.add(email)

        student = User(
            email=email,
            password_hash=_hash("Student123!"),
            first_name=first,
            last_name=last,
            role="student",
            is_active=True,
        )
        db.add(student)
        students.append(student)

    db.flush()
    print(f"  ✓ 1 instructor + {len(students)} students seeded")
    return instructor, students


def seed_class_and_enrollments(db, instructor, students) -> object:
    """Seed one class and enroll all students."""
    cls = Class(
        instructor_id=instructor.id,
        name="Algorithms & Data Structures",
        code="COS226-F2025",
        semester="Fall 2025",
        academic_year=2025,
        is_active=True,
    )
    db.add(cls)
    db.flush()

    for student in students:
        db.add(Enrollment(
            student_id=student.id,
            class_id=cls.id,
            status="active",
        ))

    db.flush()
    print(f"  ✓ Class '{cls.name}' ({cls.code}) created — {len(students)} students enrolled")
    return cls
