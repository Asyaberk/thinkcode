"""
Seed: Course Classes.
Creates 5 visually rich courses owned by the first active instructor,
then enrols up to 15 students in each course.
"""
from app.db.models import User, Class, Enrollment

COURSES = [
    {
        "name": "Algorithms & Data Structures",
        "code": "CMPE211",
        "description": "Master the fundamental building blocks of computer science: sorting, searching, graphs, trees, and dynamic programming. Build intuition for algorithmic complexity and elegant problem-solving.",
        "semester": "Fall 2025",
        "color": "#10b981",
        "thumbnail_url": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60",
    },
    {
        "name": "Systems Programming",
        "code": "CS204",
        "description": "Dive deep into operating systems, memory management, concurrency, and low-level C programming. Understand how software interacts with hardware.",
        "semester": "Fall 2025",
        "color": "#6366f1",
        "thumbnail_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60",
    },
    {
        "name": "Machine Learning Fundamentals",
        "code": "CMPE462",
        "description": "From linear regression to neural networks — learn the mathematical foundations and practical implementations of modern machine learning algorithms.",
        "semester": "Spring 2025",
        "color": "#f59e0b",
        "thumbnail_url": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=60",
    },
    {
        "name": "Database Systems",
        "code": "CMPE321",
        "description": "Relational theory, SQL mastery, indexing strategies, transaction management, and NoSQL paradigms. Design systems that scale to millions of records.",
        "semester": "Spring 2025",
        "color": "#3b82f6",
        "thumbnail_url": "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop&q=60",
    },
    {
        "name": "Computer Networks",
        "code": "CMPE331",
        "description": "TCP/IP, routing protocols, network security, and distributed systems architecture. Understand how the internet works from packets to protocols.",
        "semester": "Fall 2025",
        "color": "#ec4899",
        "thumbnail_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=60",
    },
]

def seed_courses(db):
    """
    Find the first active instructor, then insert each course from the COURSES list.
    Skips any course whose code already exists; updates visuals for existing entries.
    Finally enrols up to 15 students in each newly created course.
    """
    instructor = (
        db.query(User)
        .filter_by(role="instructor", is_active=True)
        .first()
    )
    if not instructor:
        print("  ⚠ No instructor found — skipping course seed")
        return []

    existing_codes = {c.code for c in db.query(Class.code).all()}

    created = []
    for course_data in COURSES:
        if course_data["code"] in existing_codes:
            cls = db.query(Class).filter_by(code=course_data["code"]).first()
            if cls:
                if not cls.description:
                    cls.description = course_data["description"]
                if not cls.color or cls.color == "#10b981":
                    cls.color = course_data["color"]
                if not cls.thumbnail_url:
                    cls.thumbnail_url = course_data["thumbnail_url"]
                if not cls.name or len(cls.name) < 4:
                    cls.name = course_data["name"]
                created.append(cls)
            print(f"  ~ Course '{course_data['code']}' already exists — updated visuals")
            continue

        cls = Class(
            instructor_id=instructor.id,
            name=course_data["name"],
            code=course_data["code"],
            description=course_data["description"],
            semester=course_data["semester"],
            color=course_data["color"],
            thumbnail_url=course_data["thumbnail_url"],
            is_active=True,
            academic_year=2025,
        )
        db.add(cls)
        created.append(cls)
        print(f"  ✓ Course '{course_data['code']}' created")

    db.flush()

    students = db.query(User).filter_by(role="student", is_active=True).limit(30).all()
    for cls in created:
        existing_enrollments = {
            e.student_id for e in db.query(Enrollment).filter_by(class_id=cls.id).all()
        }
        new_count = 0
        for student in students[:15]:
            if student.id not in existing_enrollments:
                db.add(Enrollment(
                    student_id=student.id,
                    class_id=cls.id,
                    status="active",
                ))
                new_count += 1
        if new_count:
            print(f"  ✓ Enrolled {new_count} students in '{cls.code}'")

    db.flush()
    return created
