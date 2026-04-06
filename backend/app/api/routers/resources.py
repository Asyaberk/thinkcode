"""
Router: /api/v1/resources

Content Builder — Kaynak yükleme ve AI extraction endpoint'leri.
Desteklenen dosya türleri: PDF, görüntü (.png/.jpg), kod (.cpp/.h/.py), metin (.txt/.md)

Kamer Hoca'nın istediği akış:
  POST /resources/upload          → Dosya yükle, course_resources'a kaydet
  POST /resources/{id}/process    → pdfplumber/GLM-OCR + GPT ile içeriği çikart
  GET  /resources/{id}/result     → Extraction sonucunu göster
  GET  /resources/                → Bu instructora ait tüm kaynakları listele

NOT: Tüm endpoint'ler sadece instructor rolüne açıktır.
     Öğrenciler bu API'yi kullanamaz.
"""

import os
import uuid
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import User, CourseResource, AiExtractedContent
from app.ai.pdf_parser import extract_text_from_bytes
from app.ai.content_extractor import extract_content_from_markdown

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["resources"])

# Yuklenen dosyalarin saklanacagi klasor
# Uretimde bu S3/GCS gibi bir object storage'a donusturulmeli
UPLOAD_DIR = Path("uploads/resources")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Desteklenen dosya türleri
# PDF: pdfplumber (metin) veya GLM-OCR (görüntü) ile işlenir
# Görüntü: GLM-OCR ile okunur (el yazısı, taranmış belge dahil)
# Kod/metin: direkt okunur, GPT'ye gönderilir
ALLOWED_EXTENSIONS = {
    # Belgeler
    ".pdf",
    # Görüntüler (GLM-OCR ile okunur)
    ".png", ".jpg", ".jpeg",
    # Kod dosyaları (direkt metin olarak okunur)
    ".cpp", ".h", ".c", ".cc",
    ".py", ".js", ".ts", ".java",
    # Metin
    ".txt", ".md",
}
MAX_FILE_SIZE_MB = 10


@router.post("/upload")
async def upload_resource(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Hoca bir dosya yükler (PDF, görüntü, kod veya metin).

    - Dosya UPLOAD_DIR'e kaydedilir
    - course_resources tablosuna status='uploaded' ile kayıt oluşturulur
    - Henüz AI extraction yapılmaz (process endpoint'i ayrı)

    Döndürür: { resource_id, filename, status }
    """
    # Sadece instructor yukleyebilir
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Sadece instructor kaynak yukleyebilir.")

    # Dosya uzantisi kontrolu
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya turu: {suffix}. Izin verilenler: {ALLOWED_EXTENSIONS}",
        )

    # Dosya boyutu kontrolu (bellegde okuyarak)
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Dosya cok buyuk. Maksimum {MAX_FILE_SIZE_MB} MB.",
        )

    # Benzersiz dosya adi olustur (cakisma onlemek icin UUID on eki)
    resource_id = str(uuid.uuid4())
    safe_filename = f"{resource_id}{suffix}"
    file_path = UPLOAD_DIR / safe_filename

    # Dosyayi diske kaydet
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    logger.info(f"Dosya yuklendi: {file.filename} ({len(file_bytes)} byte) → {file_path}")

    # DB kaydini olustur
    resource = CourseResource(
        id=resource_id,
        instructor_id=current_user.id,
        filename=file.filename or safe_filename,
        file_path=str(file_path),
        file_type=suffix.lstrip("."),  # ".pdf" → "pdf"
        status="uploaded",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return {
        "resource_id": resource.id,
        "filename": resource.filename,
        "status": resource.status,
        "message": "Dosya basariyla yuklendi. Isleme baslatmak icin /process endpoint'ini kullanin.",
    }


@router.post("/{resource_id}/process")
def process_resource(
    resource_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Yuklenen kaynagi AI ile isler:
      1. pdfplumber/Chandra ile metin cikarilir (raw_markdown)
      2. GPT-4o-mini ile Topics/Lessons/Questions uretilir
      3. Sonuclar DB'ye kaydedilir

    Bu islem zaman alabilir (buyuk PDF icin 30-60 sn).
    Islem arka planda baslatilir; sonucu /result ile sorgulanabilir.

    Dondurur: { message, status }
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Sadece instructor kaynak isleyebilir.")

    # Kaynagi bul ve sahipligini dogrula
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadi.")

    if resource.status == "processing":
        raise HTTPException(status_code=409, detail="Bu kaynak zaten isleniyor.")

    if resource.status == "done":
        raise HTTPException(status_code=409, detail="Bu kaynak zaten islendi. Tekrar islemek icin yeni yukleyin.")

    # Status'u 'processing' yap
    resource.status = "processing"
    resource.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Arka planda isle (kullaniciyi bekletme)
    background_tasks.add_task(
        _process_resource_task,
        resource_id=resource_id,
        file_path=resource.file_path,
    )

    return {
        "resource_id": resource_id,
        "status": "processing",
        "message": "Islem baslatildi. Sonucu /resources/{id}/result ile sorgulayabilirsiniz.",
    }


@router.get("/{resource_id}/result")
def get_resource_result(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kaynak islem sonucunu dondurur.

    status='processing' ise hala calisiyordur.
    status='done'       ise topics/lessons/problems sayilari gelir.
    status='failed'     ise hata mesaji gelir.

    Dondurur: { status, topics_created, lessons_created, problems_created, error_message }
    """
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadi.")

    # En son extraction kaydini getir
    extraction = (
        db.query(AiExtractedContent)
        .filter(AiExtractedContent.resource_id == resource_id)
        .order_by(AiExtractedContent.created_at.desc())
        .first()
    )

    return {
        "resource_id": resource_id,
        "filename": resource.filename,
        "status": resource.status,
        "error_message": resource.error_message,
        "topics_created":   extraction.topics_created   if extraction else 0,
        "lessons_created":  extraction.lessons_created  if extraction else 0,
        "problems_created": extraction.problems_created if extraction else 0,
        "created_at": resource.created_at,
        "updated_at": resource.updated_at,
    }


@router.get("/")
def list_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bu instructora ait tum kaynaklari listeler.
    Content Builder sayfasindaki 'Resources' bolumunu doldurur.
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Sadece instructor kaynak gorebilir.")

    resources = (
        db.query(CourseResource)
        .filter(CourseResource.instructor_id == current_user.id)
        .order_by(CourseResource.created_at.desc())
        .all()
    )

    return [
        {
            "resource_id": r.id,
            "filename": r.filename,
            "file_type": r.file_type,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in resources
    ]


# ─── Arka plan gorevi ────────────────────────────────────────────────────────

def _process_resource_task(resource_id: str, file_path: str):
    """
    Arka planda calistirilan islem gorevi.

    BackgroundTasks tarafindan cagirilir; kendi DB oturumunu olusturur.
    Hata olursa status='failed' ve error_message yazilir.
    """
    # Arka plan gorevinde yeni bir DB oturumu acmamiz gerekiyor
    from app.db.session import SessionLocal
    from openai import OpenAI

    db = SessionLocal()
    try:
        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if not resource:
            logger.error(f"Arka plan gorevi: kaynak bulunamadi: {resource_id}")
            return

        # ADIM 1: Dosyadan metin çıkar (PDF, görüntü, kod — türü otomatik algılanır)
        logger.info(f"[{resource_id}] Dosya işleniyor: {file_path}")
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        markdown_text = extract_text_from_bytes(file_bytes, resource.filename)

        # raw_markdown'i DB'ye kaydet
        resource.raw_markdown = markdown_text
        resource.updated_at = datetime.now(timezone.utc)
        db.commit()

        # ADIM 2: Markdown → Topics/Lessons/Problems (GPT)
        logger.info(f"[{resource_id}] GPT extraction basliyor...")
        openai_client = OpenAI()
        result = extract_content_from_markdown(
            markdown_text=markdown_text,
            resource_id=resource_id,
            db=db,
            openai_client=openai_client,
        )

        # Basarili: status = done
        resource.status = "done"
        resource.error_message = None
        resource.updated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            f"[{resource_id}] TAMAMLANDI: "
            f"{result['topics_created']} topic, "
            f"{result['lessons_created']} lesson, "
            f"{result['problems_created']} problem"
        )

    except Exception as e:
        # Hata: status = failed, mesaji kaydet
        logger.exception(f"[{resource_id}] Islem hatasi: {e}")
        try:
            resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
            if resource:
                resource.status = "failed"
                resource.error_message = str(e)
                resource.updated_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
