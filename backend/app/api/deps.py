"""
deps.py — FastAPI Bağımlılık Enjeksiyonu (Dependency Injection)

Her endpoint'te tekrar tekrar yazılması gereken ortak işlevler burada tanımlanır
ve Depends() mekanizmasıyla otomatik olarak enjekte edilir.

FONKSİYONLAR:
  get_db()
    → Her HTTP isteği için yeni bir PostgreSQL oturumu açar.
      İstek bitince otomatik olarak kapatır (finally bloğu).
      Tüm routerlarda: db: Session = Depends(get_db)

  get_current_user()
    → HTTP Authorization başlığındaki "Bearer <token>" JWT'yi çözer.
      Token geçersizse 401 Unauthorized fırlatır.
      Kullanıcı aktif değilse 401 fırlatır.
      Başarılıysa User model nesnesi döner.
      Tüm korumalı routerlarda: current_user: User = Depends(get_current_user)

  require_instructor()
    → Yukarıdaki get_current_user'ı çağırır, ek olarak rol kontrolü yapar.
      Instructor veya admin değilse 403 Forbidden fırlatır.
      Sadece instructor endpointlerinde kullanılır.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from app.db.session import SessionLocal
from app.core.security import decode_token
from app.db.models import User

bearer_scheme = HTTPBearer()


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
