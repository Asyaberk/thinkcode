"""

  get_db()

  get_current_user()

  require_instructor()

"""

from fastapi import Depends, HTTPException, status

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session

from jose import JWTError

from app.db.session import SessionLocal

from app.core.security import decode_token

from app.db.models import User

from typing import Optional

bearer_scheme          = HTTPBearer()

bearer_scheme_optional = HTTPBearer(auto_error=False)

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()

def get_current_user(

    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),

    db: Session = Depends(get_db),

) -> User:

    token = credentials.credentials

    try:

        payload = decode_token(token)

        user_id: str = payload.get("sub")

        if not user_id:

            raise HTTPException(status_code=401, detail="Invalid token")

    except JWTError:

        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, user_id)

    if not user or not user.is_active:

        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user

def require_instructor(current_user: User = Depends(get_current_user)) -> User:

    if current_user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Instructor access required")

    return current_user

def get_current_user_optional(

    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme_optional),

    db: Session = Depends(get_db),

) -> Optional[User]:

    """Returns None when no Authorization header is present."""

    if not credentials:

        return None

    try:

        payload = decode_token(credentials.credentials)

        user_id: str = payload.get("sub")

        if not user_id:

            return None

    except JWTError:

        return None

    user = db.get(User, user_id)

    return user if (user and user.is_active) else None

