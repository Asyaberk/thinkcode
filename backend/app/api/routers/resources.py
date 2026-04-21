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
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.db.models import User, CourseResource, AiExtractedContent
from app.ai.pdf_parser import extract_text_from_bytes
from app.ai.content_extractor import extract_content_from_markdown
from app.ai.link_extractor import extract_text_from_link, detect_url_type

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
    week_name: Optional[str] = Form(None),  # ör: "Week 1" — opsiyonel
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
        file_type=suffix.lstrip("."),
        week_name=week_name,          # Week 1, Week 2 vs.
        status="uploaded",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # MinIO'ya yükle (kalıcı depolama) — hata olursa lokal fallback çalışmaya devam eder
    try:
        from app.storage.minio_client import upload_file as minio_upload, make_object_key, get_content_type
        minio_key = make_object_key(resource_id, safe_filename)
        ct = get_content_type(safe_filename)
        minio_upload(str(file_path), minio_key, ct)
        logger.info(f"[MinIO] Başarıyla yüklendi: {minio_key}")
    except Exception as exc:
        logger.warning(f"[MinIO] Yükleme başarısız (lokal fallback aktif): {exc}")

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
    class_id: Optional[str] = None,
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
        week_name=resource.week_name,  # Week parent topic için
        class_id=class_id,             # Hangi sınıfa ait
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
        .order_by(
            CourseResource.week_name.nullslast(),   # Aynı modüller bir arada
            CourseResource.created_at.desc()
        )
        .all()
    )

    return [
        {
            "resource_id":   r.id,
            "filename":      r.filename,
            "file_type":     r.file_type,
            "week_name":     r.week_name,
            "status":        r.status,
            "error_message": r.error_message,
            "source_url":    r.source_url,
            "has_file":      bool(r.file_path and r.file_path.strip()),
            "download_url":  f"/api/v1/resources/{r.id}/download" if (r.file_path and r.file_path.strip()) else None,
            "created_at":    r.created_at,
        }
        for r in resources
    ]


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kaynağı sil: DB kaydı + MinIO nesnesi + lokal disk dosyası.
    Sadece kendi kaydettikleri kaynakları silebilirler.
    """
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı veya bu size ait değil.")

    # MinIO'dan sil
    if resource.file_path and resource.file_path.strip():
        try:
            from app.storage.minio_client import make_object_key, _client
            from pathlib import Path as _Path
            from app.core.config import settings as _s
            minio_key = make_object_key(resource.id, _Path(resource.file_path).name)
            _client().remove_object(_s.MINIO_BUCKET_NAME, minio_key)
            logger.info(f"[MinIO] Silindi: {minio_key}")
        except Exception as exc:
            logger.warning(f"[MinIO] Silinemedi (devam ediliyor): {exc}")

        # Lokal diskten sil
        try:
            if os.path.exists(resource.file_path):
                os.remove(resource.file_path)
                logger.info(f"[Disk] Silindi: {resource.file_path}")
        except Exception as exc:
            logger.warning(f"[Disk] Silinemedi: {exc}")

    db.delete(resource)
    db.commit()
    # 204 No Content


@router.post("/link", status_code=201)
def add_resource_link(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    source_url: str = Form(...),
    link_type: str = Form("link"),
    week_name: Optional[str] = Form(None),
    class_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Harici link ekle (YouTube, Google Drive, web sayfası).

    URL tipine göre işleme baSlar:
      - YouTube  → Whisper transkript → GPT extraction (async)
      - Drive/PDF URL → indir → GPT extraction (async)
      - Web sayfası → scrape → GPT extraction (async)

    Döndürür: { resource_id, title, source_url, status }
    """
    if current_user.role not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Sadece instructor link ekleyebilir.")

    resource_id = str(uuid.uuid4())
    url_type = detect_url_type(source_url)
    # link_type alanını URL tipinden otomatik ayarla
    if url_type == "youtube":
        resolved_type = "video"
    elif url_type in ("direct_pdf", "google_drive"):
        resolved_type = "pdf"
    else:
        resolved_type = link_type   # Form'dan gelen

    resource = CourseResource(
        id=resource_id,
        instructor_id=current_user.id,
        filename=title,
        file_path="",
        file_type=resolved_type,
        week_name=week_name,
        source_url=source_url,
        status="processing",   # async işleme başlayacak
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()

    background_tasks.add_task(
        _process_link_task,
        resource_id=resource_id,
        source_url=source_url,
        week_name=week_name,
        class_id=class_id,
    )

    logger.info(f"Link eklendi ve işleme başlatıldı: {title} → {source_url} [{url_type}]")
    return {
        "resource_id": resource_id,
        "title": title,
        "source_url": source_url,
        "link_type": resolved_type,
        "status": "processing",
        "message": "Link alındı, içerik çıkarılıyor. Sonucu /resources/{id}/result ile sorgulayabilirsiniz.",
    }


def _process_link_task(
    resource_id: str,
    source_url: str,
    week_name: Optional[str] = None,
    class_id: Optional[str] = None,
) -> None:
    """
    Arka planda çalışan link işleme görevi.
    URL'den metin çıkarır ve mevcut AI extraction pipeline'ına gönderir.
    """
    from app.db.session import SessionLocal
    from openai import OpenAI

    db = SessionLocal()
    client = OpenAI()
    try:
        logger.info(f"Link işleniyor: {source_url}")
        text = extract_text_from_link(source_url, client)

        logger.info(f"Metin çıkarıldı ({len(text)} karakter), AI extraction başlıyor...")
        extract_content_from_markdown(
            markdown_text=text,
            resource_id=resource_id,
            db=db,
            openai_client=client,
            week_name=week_name,
            class_id=class_id,
        )

        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if resource:
            resource.status = "done"
            resource.raw_markdown = text[:10000]  # ilk 10K karakter sakla
            resource.updated_at = datetime.now(timezone.utc)
            db.commit()
        logger.info(f"Link işleme tamamlandı: {resource_id}")

    except Exception as exc:
        logger.error(f"Link işleme hatası ({resource_id}): {exc}")
        resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
        if resource:
            resource.status = "failed"
            resource.error_message = str(exc)[:500]
            resource.updated_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@router.get("/{resource_id}/content")
def get_resource_content(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    İşlenmiş kaynağın çıkarılan içeriğini döndürür.

    Content Builder sayfasında Topics/Lessons/Questions sekmelerini
    gerçek AI çıktısıyla doldurmak için kullanılır.

    Döndürür: GPT'nin ürettiği ham JSON
      { course_title, topics: [{name, description, lessons, questions}], misconceptions }
    """
    resource = db.query(CourseResource).filter(
        CourseResource.id == resource_id,
        CourseResource.instructor_id == current_user.id,
    ).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı.")

    extraction = (
        db.query(AiExtractedContent)
        .filter(AiExtractedContent.resource_id == resource_id)
        .order_by(AiExtractedContent.created_at.desc())
        .first()
    )

    if not extraction:
        return {"course_title": "", "topics": [], "misconceptions": []}

    return extraction.extracted_json


@router.get("/{resource_id}/download")
def download_resource(
    resource_id: str,
    token: Optional[str] = None,   # ?token= query param ile auth (yeni sekme için)
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    PDF kaynağını tarayıcıda görüntülemek veya indirmek için.
    Öğrenciler LearningPage'deki 'Kaynağa Git' butonuyla erişir.
    Instructor CourseBuilder'dan tıklayarak erişebilir.

    Auth: Authorization header VEYA ?token= query param

    - file_path dolu ise → FileResponse (PDF inline)
    - source_url dolu ise → 302 redirect (YouTube, Drive, web)
    - İkisi de yoksa → 404
    """
    from fastapi.responses import FileResponse, RedirectResponse
    from app.core.security import decode_token
    from app.db.models import User as UserModel

    # Token query param fallback (yeni sekmede Authorization header gönderilemiyor)
    user = current_user
    if user is None and token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = db.query(UserModel).filter(UserModel.id == user_id).first()
        except Exception:
            pass

    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    resource = db.query(CourseResource).filter(CourseResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı.")

    # Harici link (YouTube, Drive) → direkt redirect
    if resource.source_url and not (resource.file_path and resource.file_path.strip()):
        return RedirectResponse(url=resource.source_url, status_code=302)

    # PDF / dosya → MinIO'dan presigned URL dene, yoksa lokal fallback
    if resource.file_path and resource.file_path.strip():
        try:
            from app.storage.minio_client import make_object_key, get_presigned_url, object_exists
            from pathlib import Path as _Path
            minio_key = make_object_key(resource.id, _Path(resource.file_path).name)
            if object_exists(minio_key):
                presigned = get_presigned_url(minio_key, expires_hours=2)
                logger.info(f"[MinIO] Presigned URL → {resource.id}")
                return RedirectResponse(url=presigned, status_code=302)
        except Exception as exc:
            logger.warning(f"[MinIO] Presigned URL üretilemedi, lokal fallback: {exc}")

        # Lokal fallback (container içi disk)
        if os.path.exists(resource.file_path):
            media_type = "application/pdf" if resource.file_type == "pdf" else "application/octet-stream"
            return FileResponse(
                path=resource.file_path,
                media_type=media_type,
                filename=resource.filename,
                headers={"Content-Disposition": f'inline; filename="{resource.filename}"'},
            )
        raise HTTPException(status_code=404, detail="Dosya ne MinIO'da ne de diskte bulundu.")

    raise HTTPException(status_code=404, detail="Bu kaynağa ait dosya veya link yok.")



# ─── Arka plan gorevi ────────────────────────────────────────────────────────

def _process_resource_task(resource_id: str, file_path: str, week_name: Optional[str] = None, class_id: Optional[str] = None):
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
            week_name=week_name,     # "Week 1" → parent topic oluşturulacak
            class_id=class_id,       # Hangi sınıfa ait
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
