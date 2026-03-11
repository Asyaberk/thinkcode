"""
JWT utility functions
"""
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings


def create_access_token(payload: dict) -> str:
    data = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    data["exp"] = expire
    return jwt.encode(data, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
