"""
Router: /api/v1/auth

"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import bcrypt
import uuid

from app.api.deps import get_db, get_current_user
from app.core.security import create_access_token
from app.db.models import User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new student or instructor account."""
    # Validation
    if body.role not in ("student", "instructor"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'instructor'")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not body.first_name.strip() or not body.last_name.strip():
        raise HTTPException(status_code=400, detail="First name and last name are required")

    # Email uniqueness check
    existing = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Hash password
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    user = User(
        id=str(uuid.uuid4()),
        email=body.email.lower().strip(),
        password_hash=hashed,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
    )

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_ok = bcrypt.checkpw(body.password.encode(), user.password_hash.encode())
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
    )

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
    }
