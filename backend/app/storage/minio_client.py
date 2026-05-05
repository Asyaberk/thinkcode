"""
MinIO / S3 object storage client.

Usage:
    from app.storage.minio_client import upload_file, get_presigned_url, object_exists
"""
import logging
from datetime import timedelta
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)

def _client() -> Minio:
    """MinIO/S3 client wrapper — lazily initialized, reused across calls."""
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
    Upload a local file to the configured MinIO bucket.

    Args:
        local_path:   Absolute path to the local source file.
        object_key:   Destination key inside the bucket.
        content_type: MIME type of the file (default: application/octet-stream).

    Returns:
        The object_key string on success.

    Raises:
        S3Error: if the upload fails.
    """
    client = _client()
    client.fput_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        local_path,
        content_type=content_type,
    )
    logger.info(f"[MinIO] Uploaded: {object_key} (bucket={settings.MINIO_BUCKET_NAME})")
    return object_key

def upload_bytes(
    data: bytes,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload raw bytes to MinIO without writing a temporary file.

    Args:
        data:         Raw bytes to upload.
        object_key:   Destination key inside the bucket.
        content_type: MIME type of the content.

    Returns:
        The object_key string on success.
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
    logger.info(f"[MinIO] Bytes uploaded: {object_key}")
    return object_key

def get_presigned_url(object_key: str, expires_hours: int = 1) -> str:
    """Generate a short-lived presigned GET URL for the given object.

    Args:
        object_key:    Key of the object in the bucket.
        expires_hours: Validity window in hours (default: 1).

    Returns:
        Presigned URL string.
    """
    client = _client()
    url = client.presigned_get_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        expires=timedelta(hours=expires_hours),
    )
    logger.debug(f"[MinIO] Presigned URL generated: {object_key}")
    return url

def object_exists(object_key: str) -> bool:
    """Return True if the object exists in the configured MinIO bucket, False otherwise."""
    try:
        _client().stat_object(settings.MINIO_BUCKET_NAME, object_key)
        return True
    except S3Error:
        return False

def make_object_key(resource_id: str, filename: str) -> str:
    """Build the canonical object key path for a resource file: resources/{resource_id}/{filename}."""
    return f"resources/{resource_id}/{filename}"

def get_content_type(filename: str) -> str:
    """Derive MIME type from file extension."""
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
