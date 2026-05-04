"""

Router: /api/v1/classes

"""

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from sqlalchemy import func

from pydantic import BaseModel

from typing import Optional

from app.api.deps import get_db, get_current_user

from app.db.models import User, Class, Enrollment

from app.core.config import settings

import openai

import json

router = APIRouter(prefix="/classes", tags=["classes"])

# ── helpers ──────────────────────────────────────────────────────────────────

def _class_to_dict(cls: Class, instructor: User, total_students: int, is_enrolled: bool,

                   enrollment_status: Optional[str] = None) -> dict:

    return {

        "class_id":          cls.id,

        "class_name":        cls.name,

        "class_code":        cls.code,

        "semester":          cls.semester or "Current Term",

        "instructor_name":   f"{instructor.first_name} {instructor.last_name}" if instructor else "Instructor",

        "total_students":    total_students,

        "is_enrolled":       is_enrolled,

        "enrollment_status": enrollment_status,   # None | 'pending' | 'active' | 'rejected' | 'dropped'

        "description":       cls.description,

        "color":             cls.color or "#10b981",

        "thumbnail_url":     cls.thumbnail_url,

        "tags":              cls.tags or "",

    }

# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ClassCreate(BaseModel):

    name:          str

    code:          str

    description:   Optional[str] = None

    semester:      Optional[str] = None

    color:         Optional[str] = "#10b981"

    thumbnail_url: Optional[str] = None

    tags:          Optional[str] = ""

class ClassUpdate(BaseModel):

    name:          Optional[str] = None

    code:          Optional[str] = None

    description:   Optional[str] = None

    semester:      Optional[str] = None

    color:         Optional[str] = None

    thumbnail_url: Optional[str] = None

    tags:          Optional[str] = None

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/my")

def my_courses(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Return course list based on user role: instructors see own classes, students see enrolled."""

    if current_user.role in ("instructor", "admin"):

        classes = (

            db.query(Class)

            .filter_by(instructor_id=current_user.id, is_active=True)

            .order_by(Class.created_at.asc())

            .all()

        )

        result = []

        for cls in classes:

            total = (

                db.query(func.count(Enrollment.id))

                .filter_by(class_id=cls.id, status="active")

                .scalar() or 0

            )

            result.append(_class_to_dict(cls, current_user, total, True))

        return result

    else:  # student — return active AND pending enrollments

        enrollments = (

            db.query(Enrollment)

            .filter(

                Enrollment.student_id == current_user.id,

                Enrollment.status.in_(["active", "pending"])

            )

            .all()

        )

        result = []

        for enr in enrollments:

            cls = db.get(Class, enr.class_id)

            if not cls or not cls.is_active:

                continue

            instructor = db.get(User, cls.instructor_id)

            total = (

                db.query(func.count(Enrollment.id))

                .filter_by(class_id=cls.id, status="active")

                .scalar() or 0

            )

            is_enrolled = enr.status == "active"

            result.append(_class_to_dict(cls, instructor, total, is_enrolled, enr.status))

        return result

@router.get("/all")

def all_courses(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    """

    classes = (

        db.query(Class)

        .filter_by(is_active=True)

        .order_by(Class.created_at.asc())

        .all()

    )

    if current_user.role in ("instructor", "admin"):

        enrollment_map = {  # class_id -> 'active' for instructor's own courses

            cls.id: "active" for cls in

            db.query(Class).filter_by(instructor_id=current_user.id, is_active=True).all()

        }

    else:

        enrollment_map = {

            enr.class_id: enr.status for enr in

            db.query(Enrollment)

            .filter(

                Enrollment.student_id == current_user.id,

                Enrollment.status.in_(["active", "pending", "rejected"]),

            ).all()

        }

    result = []

    for cls in classes:

        instructor = db.get(User, cls.instructor_id)

        total = (

            db.query(func.count(Enrollment.id))

            .filter_by(class_id=cls.id, status="active")

            .scalar() or 0

        )

        enr_status = enrollment_map.get(cls.id)

        is_enrolled = enr_status == "active"

        result.append(_class_to_dict(cls, instructor, total, is_enrolled, enr_status))

    return result

@router.get("/search")

def search_classes(

    q: str = "",

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    """

    from sqlalchemy import or_

    base_q = db.query(Class).filter(Class.is_active == True)

    if q and q.strip():

        terms = [t.strip().lower() for t in q.replace(",", " ").split() if len(t.strip()) > 1]

        if terms:

            filters = []

            for term in terms:

                filters.append(Class.name.ilike(f"%{term}%"))

                filters.append(Class.description.ilike(f"%{term}%"))

                filters.append(Class.tags.ilike(f"%{term}%"))

                filters.append(Class.code.ilike(f"%{term}%"))

            base_q = base_q.filter(or_(*filters))

    classes = base_q.order_by(Class.created_at.asc()).all()

    if current_user.role in ("instructor", "admin"):

        enrollment_map = {

            cls.id: "active" for cls in

            db.query(Class).filter_by(instructor_id=current_user.id, is_active=True).all()

        }

    else:

        enrollment_map = {

            enr.class_id: enr.status for enr in

            db.query(Enrollment)

            .filter(

                Enrollment.student_id == current_user.id,

                Enrollment.status.in_(["active", "pending", "rejected"]),

            ).all()

        }

    result = []

    for cls in classes:

        instructor = db.get(User, cls.instructor_id)

        total = (

            db.query(func.count(Enrollment.id))

            .filter_by(class_id=cls.id, status="active")

            .scalar() or 0

        )

        enr_status = enrollment_map.get(cls.id)

        is_enrolled = enr_status == "active"

        result.append(_class_to_dict(cls, instructor, total, is_enrolled, enr_status))

    return result

@router.post("", status_code=status.HTTP_201_CREATED)

def create_class(

    body: ClassCreate,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Instructor: create a new class."""

    if current_user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Only instructors can create classes")

    existing_active = db.query(Class).filter_by(code=body.code, is_active=True).first()

    if existing_active:

        raise HTTPException(status_code=409, detail=f"Class code '{body.code}' already exists")

    existing_inactive = db.query(Class).filter(

        Class.code == body.code, Class.is_active == False

    ).all()

    for old in existing_inactive:

        db.delete(old)

    cls = Class(

        instructor_id=current_user.id,

        name=body.name,

        code=body.code,

        description=body.description,

        semester=body.semester or "Current Term",

        color=body.color or "#10b981",

        thumbnail_url=body.thumbnail_url,

        tags=body.tags or "",

        is_active=True,

    )

    db.add(cls)

    db.commit()

    db.refresh(cls)

    return _class_to_dict(cls, current_user, 0, True)

@router.put("/{class_id}")

def update_class(

    class_id: str,

    body: ClassUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Instructor: update class details."""

    cls = db.get(Class, class_id)

    if not cls or not cls.is_active:

        raise HTTPException(status_code=404, detail="Class not found")

    if cls.instructor_id != current_user.id and current_user.role != "admin":

        raise HTTPException(status_code=403, detail="Not your class")

    if body.name is not None:        cls.name = body.name

    if body.code is not None:        cls.code = body.code

    if body.description is not None: cls.description = body.description

    if body.semester is not None:    cls.semester = body.semester

    if body.color is not None:       cls.color = body.color

    if body.thumbnail_url is not None: cls.thumbnail_url = body.thumbnail_url

    if body.tags is not None:        cls.tags = body.tags

    db.commit()

    db.refresh(cls)

    total = (

        db.query(func.count(Enrollment.id))

        .filter_by(class_id=cls.id, status="active")

        .scalar() or 0

    )

    return _class_to_dict(cls, current_user, total, True)

@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)

def delete_class(

    class_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Instructor: soft-delete a class by setting is_active=False."""

    cls = db.get(Class, class_id)

    if not cls or not cls.is_active:

        raise HTTPException(status_code=404, detail="Class not found")

    if cls.instructor_id != current_user.id and current_user.role != "admin":

        raise HTTPException(status_code=403, detail="Not your class")

    cls.is_active = False

    db.commit()

@router.post("/{class_id}/enroll", status_code=status.HTTP_201_CREATED)

def enroll(

    class_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Student sends enrollment request — status starts as 'pending' until instructor approves."""

    if current_user.role not in ("student",):

        raise HTTPException(status_code=403, detail="Only students can request enrollment")

    cls = db.get(Class, class_id)

    if not cls or not cls.is_active:

        raise HTTPException(status_code=404, detail="Class not found")

    existing = (

        db.query(Enrollment)

        .filter_by(student_id=current_user.id, class_id=class_id)

        .first()

    )

    if existing:

        if existing.status in ("active", "pending"):

            raise HTTPException(

                status_code=409,

                detail="Already enrolled" if existing.status == "active" else "Request already pending"

            )

        # dropped or rejected → allow re-request

        from datetime import datetime, timezone

        existing.status = "pending"

        existing.requested_at = datetime.now(timezone.utc)

        db.commit()

        return {"detail": "Re-requested enrollment", "status": "pending"}

    from datetime import datetime, timezone

    enr = Enrollment(

        student_id=current_user.id,

        class_id=class_id,

        status="pending",

        requested_at=datetime.now(timezone.utc),

    )

    db.add(enr)

    db.commit()

    return {"detail": "Enrollment requested — awaiting instructor approval", "status": "pending"}

@router.delete("/{class_id}/enroll", status_code=status.HTTP_200_OK)

def unenroll(

    class_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Student: cancel pending request or leave active enrollment."""

    enr = (

        db.query(Enrollment)

        .filter(

            Enrollment.student_id == current_user.id,

            Enrollment.class_id == class_id,

            Enrollment.status.in_(["active", "pending"]),

        )

        .first()

    )

    if not enr:

        raise HTTPException(status_code=404, detail="Enrollment not found")

    enr.status = "dropped"

    db.commit()

    return {"detail": "Unenrolled"}

# ── Enrollment Management (Instructor only) ──────────────────────────────────

@router.get("/{class_id}/enrollments")

def list_enrollments(

    class_id: str,

    enrollment_status_filter: Optional[str] = None,  # 'pending' | 'active' | 'all'

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    Instructor: list all enrollment requests for a class.

    Optionally filter by status (pending, active, all).

    """

    import uuid as _uuid

    try:

        _uuid.UUID(class_id)

    except ValueError:

        raise HTTPException(status_code=422, detail="Invalid class_id format")

    cls = db.get(Class, class_id)

    if not cls:

        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Instructor access required")

    if cls.instructor_id != current_user.id and current_user.role != "admin":

        raise HTTPException(status_code=403, detail="Not your class")

    query = db.query(Enrollment).filter_by(class_id=class_id)

    if enrollment_status_filter and enrollment_status_filter != "all":

        query = query.filter(Enrollment.status == enrollment_status_filter)

    else:

        # Default: show pending + active (skip dropped/rejected unless explicitly asked)

        query = query.filter(Enrollment.status.in_(["pending", "active"]))

    enrollments = query.order_by(Enrollment.requested_at.asc()).all()

    result = []

    for enr in enrollments:

        student = db.get(User, enr.student_id)

        if not student:

            continue

        result.append({

            "enrollment_id": enr.id,

            "student_id":    enr.student_id,

            "first_name":    student.first_name,

            "last_name":     student.last_name,

            "email":         student.email,

            "status":        enr.status,

            "requested_at":  enr.requested_at.isoformat() if enr.requested_at else None,

            "enrolled_at":   enr.enrolled_at.isoformat() if enr.enrolled_at else None,

        })

    return result

@router.patch("/{class_id}/enrollments/{enrollment_id}/approve")

def approve_enrollment(

    class_id: str,

    enrollment_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Instructor: approve a pending enrollment request."""

    cls = db.get(Class, class_id)

    if not cls:

        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Instructor access required")

    if cls.instructor_id != current_user.id and current_user.role != "admin":

        raise HTTPException(status_code=403, detail="Not your class")

    enr = db.get(Enrollment, enrollment_id)

    if not enr or enr.class_id != class_id:

        raise HTTPException(status_code=404, detail="Enrollment not found")

    if enr.status != "pending":

        raise HTTPException(status_code=409, detail=f"Enrollment is already '{enr.status}'")

    from datetime import datetime, timezone

    enr.status = "active"

    enr.enrolled_at = datetime.now(timezone.utc)

    db.commit()

    return {"detail": "Enrollment approved", "enrollment_id": enrollment_id}

@router.patch("/{class_id}/enrollments/{enrollment_id}/reject")

def reject_enrollment(

    class_id: str,

    enrollment_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Instructor: reject a pending enrollment request."""

    cls = db.get(Class, class_id)

    if not cls:

        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Instructor access required")

    if cls.instructor_id != current_user.id and current_user.role != "admin":

        raise HTTPException(status_code=403, detail="Not your class")

    enr = db.get(Enrollment, enrollment_id)

    if not enr or enr.class_id != class_id:

        raise HTTPException(status_code=404, detail="Enrollment not found")

    if enr.status not in ("pending", "active"):

        raise HTTPException(status_code=409, detail=f"Cannot reject enrollment with status '{enr.status}'")

    enr.status = "rejected"

    db.commit()

    return {"detail": "Enrollment rejected", "enrollment_id": enrollment_id}

