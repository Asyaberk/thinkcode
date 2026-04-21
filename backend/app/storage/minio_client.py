"""
minio_client.py — MinIO nesne depolama yardımcıları

Kullanım:
    from app.storage.minio_client import upload_file, get_presigned_url, object_exists

Tüm işlemler MINIO_* ortam değişkenlerine dayanır (app.core.config).

MinIO key formatı: resources/{resource_id}/{filename}
Bu format, resource_id'den key türetmeyi kolaylaştırır (DB değişikliği gerekmez).
"""
import logging
from datetime import timedelta
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)


def _client() -> Minio:
    """Singleton benzeri MinIO istemcisi — her çağrıda yeni bağlantı kurmaz."""
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def upload_file(
    local_path: str,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Lokal dosyayı MinIO bucket'ına yükler.

    Args:
        local_path: Yüklenecek dosyanın lokal yolu
        object_key: MinIO'daki hedef anahtar (ör. "resources/{id}/doc.pdf")
        content_type: MIME type

    Returns:
        object_key (yüklenen nesnenin anahtarı)

    Raises:
        Exception: MinIO erişilemiyorsa veya yükleme başarısızsa
    """
    client = _client()
    client.fput_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        local_path,
        content_type=content_type,
    )
    logger.info(f"[MinIO] Yüklendi: {object_key} ({settings.MINIO_BUCKET_NAME})")
    return object_key


def upload_bytes(
    data: bytes,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Bytes verisini MinIO'ya yükler (lokal dosya olmadan).
    """
    import io
    client = _client()
    client.put_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    logger.info(f"[MinIO] Bytes yüklendi: {object_key}")
    return object_key


def get_presigned_url(object_key: str, expires_hours: int = 1) -> str:
    """
    Geçici erişim URL'si üretir (varsayılan 1 saat).

    Tarayıcı bu URL'ye direkt erişebilir (auth gerekmez).
    PDF download için download endpoint bu URL'ye redirect eder.
    """
    client = _client()
    url = client.presigned_get_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        expires=timedelta(hours=expires_hours),
    )
    logger.debug(f"[MinIO] Presigned URL üretildi: {object_key}")
    return url


def object_exists(object_key: str) -> bool:
    """
    MinIO'da bu key'e ait nesne var mı?
    Yoksa S3Error fırlatır — biz onu yakalayıp False dönüyoruz.
    """
    try:
        _client().stat_object(settings.MINIO_BUCKET_NAME, object_key)
        return True
    except S3Error:
        return False


def make_object_key(resource_id: str, filename: str) -> str:
    """
    Standart MinIO key formatı: resources/{resource_id}/{filename}
    DB'de ayrı sütun tutmak yerine bu fonksiyonla key türetiriz.
    """
    return f"resources/{resource_id}/{filename}"


def get_content_type(filename: str) -> str:
    """Dosya uzantısından MIME type belirle."""
    ext = Path(filename).suffix.lower()
    types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
        ".txt": "text/plain",
        ".md":  "text/markdown",
        ".cpp": "text/x-c++src",
        ".py":  "text/x-python",
    }
    return types.get(ext, "application/octet-stream")
