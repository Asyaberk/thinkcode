"""
pdf_parser.py — Akilli Dosya Okuyucu (Smart File Router)

Bu modül hocanın yüklediği her türlü dosyadan metin çıkarır.

Desteklenen dosya türleri:
  .pdf        → Önce pdfplumber (metin tabanlıysa hızlı), boşsa GLM-OCR (görüntü tabanlı)
  .png / .jpg → Doğrudan GLM-OCR (görüntüden metin)
  .cpp / .h   → Doğrudan oku (zaten metin)
  .py / .txt  → Doğrudan oku
  .md         → Doğrudan oku

Pipeline'daki yeri:
  Dosya Yüklendi → Bu modül metni çıkarır → GPT-4.1-nano işler → DB'ye kaydolur

Çıktı: str (ham metin, GPT'ye gönderilecek)
"""

import os
import base64
import logging
import tempfile
from pathlib import Path
from io import BytesIO

import requests

logger = logging.getLogger(__name__)

# Desteklenen dosya uzantıları
PDF_EXTENSIONS  = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
CODE_EXTENSIONS  = {
    ".cpp", ".h", ".c", ".cc",       # C/C++
    ".py",                            # Python
    ".js", ".ts",                     # JavaScript / TypeScript
    ".java",                          # Java
    ".cs",                            # C#
    ".txt", ".md",                    # Düz metin
}

# pdfplumber'dan ne kadar az metin gelirse "görüntü tabanlı PDF" sayarız
MIN_TEXT_THRESHOLD = 50  # karakter


def extract_text_from_file(file_path: str) -> str:
    """
    Dosya uzantısına bakarak doğru okuma yöntemini seçer.

    Args:
        file_path: Sunucudaki dosyanın tam yolu

    Returns:
        str: Ham metin (GPT'ye gönderilecek)

    Raises:
        ValueError: Desteklenmeyen dosya türü
        RuntimeError: Okuma başarısız
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")

    suffix = path.suffix.lower()

    if suffix in PDF_EXTENSIONS:
        return _process_pdf(file_path)
    elif suffix in IMAGE_EXTENSIONS:
        return _extract_with_glm_ocr_image(file_path)
    elif suffix in CODE_EXTENSIONS:
        return _read_text_file(file_path)
    else:
        # Bilinmeyen uzantı — metin olarak okumayı dene
        logger.warning(f"Bilinmeyen uzantı '{suffix}', metin olarak okunuyor.")
        return _read_text_file(file_path)


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Bellek içindeki dosya byte'larından metin çıkarır.

    Upload endpoint'inden doğrudan bytes geldiğinde kullanılır;
    geçici dosya oluşturulur, işlenir, silinir.

    Args:
        file_bytes: Dosya içeriğinin byte dizisi
        filename:   Uzantıyı belirlemek için orijinal dosya adı

    Returns:
        str: Ham metin
    """
    suffix = Path(filename).suffix.lower() or ".pdf"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        return extract_text_from_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── PDF İşleme ──────────────────────────────────────────────────────────────

def _process_pdf(file_path: str) -> str:
    """
    PDF dosyasından metin çıkarır.

    Strateji:
      1. pdfplumber ile metni dene (hızlı, GPU yok, ücretsiz)
      2. Yeterli metin geldiyse → kullan (metin tabanlı PDF)
      3. Yetersiz metin geldiyse → sayfaları görüntüye çevir → GLM-OCR
         (görüntü tabanlı / taranmış PDF)
    """
    logger.info(f"PDF işleniyor: {file_path}")

    # Adım 1: pdfplumber
    text = _extract_with_pdfplumber(file_path)

    if text and len(text.strip()) >= MIN_TEXT_THRESHOLD:
        logger.info(f"pdfplumber başarılı: {len(text)} karakter")
        return text

    # Adım 2: pdfplumber yetersiz → GLM-OCR
    logger.info("pdfplumber yetersiz metin buldu, GLM-OCR deneniyor...")
    return _extract_pdf_with_glm_ocr(file_path)


def _extract_with_pdfplumber(file_path: str) -> str:
    """
    pdfplumber ile PDF'den metin çıkarır.
    Sadece metni gömülü PDF'lerde çalışır (görüntü tabanlıysa boş döner).
    """
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber yüklü değil, atlaniyor.")
        return ""

    pages_text = []

    try:
        with pdfplumber.open(file_path) as pdf:
            logger.info(f"pdfplumber: {len(pdf.pages)} sayfa")

            for i, page in enumerate(pdf.pages, start=1):
                page_header = f"\n\n## Sayfa {i}\n\n"

                # Tablo varsa Markdown'a çevir
                tables = page.extract_tables()
                if tables:
                    text_parts = [page_header]
                    for table in tables:
                        text_parts.append(_table_to_markdown(table))
                    raw = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                    if raw.strip():
                        text_parts.append(raw)
                    pages_text.append("\n".join(text_parts))
                else:
                    raw = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                    pages_text.append(page_header + raw)

    except Exception as e:
        logger.error(f"pdfplumber hatası: {e}")
        return ""

    return "\n".join(pages_text)


def _extract_pdf_with_glm_ocr(file_path: str) -> str:
    """
    PDF'i sayfa sayfa görüntüye çevirir ve her sayfayı GLM-OCR'a gönderir.

    Neden sayfa sayfa?
    - GLM-OCR görüntü alıyor, PDF değil
    - pdf2image her sayfayı PNG'ye çeviriyor
    - Sonra base64 yapıp sunucuya gönderiyoruz
    """
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise RuntimeError(
            "pdf2image yüklü değil. Yüklemek için: pip install pdf2image"
        )

    logger.info("PDF sayfaları görüntüye çevriliyor (dpi=72)...")
    pages = convert_from_path(file_path, dpi=72)
    logger.info(f"{len(pages)} sayfa bulundu")

    all_text = []
    for i, page_img in enumerate(pages, start=1):
        logger.info(f"  Sayfa {i}/{len(pages)} GLM-OCR'a gönderiliyor...")
        try:
            text = _send_image_to_glm_ocr(page_img)
            all_text.append(f"## Sayfa {i}\n\n{text}")
        except Exception as e:
            logger.warning(f"  Sayfa {i} GLM-OCR hatası: {e}")
            all_text.append(f"## Sayfa {i}\n\n[Okunamadı]")

    return "\n\n".join(all_text)


# ─── Görüntü İşleme ──────────────────────────────────────────────────────────

def _extract_with_glm_ocr_image(file_path: str) -> str:
    """
    .png / .jpg gibi görüntü dosyalarından GLM-OCR ile metin çıkarır.
    El yazısı, taranmış belgeler, ekran görüntüleri için.
    """
    logger.info(f"Görüntü GLM-OCR'a gönderiliyor: {file_path}")

    from PIL import Image
    img = Image.open(file_path)
    return _send_image_to_glm_ocr(img)


def _send_image_to_glm_ocr(pil_image) -> str:
    """
    PIL görüntüsünü Mert'in GLM-OCR sunucusuna gönderir, metni döndürür.

    Nasıl çalışır:
      1. PIL görüntüsü → PNG byte'ları → base64 metni
      2. OpenAI-uyumlu API formatında POST isteği
      3. "Text Recognition:" → GLM-OCR'nin resmi OCR promptu
      4. Sunucu metni döndürür
    """
    from app.core.config import settings

    # Görüntüyü base64'e çevir
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    # İstek gövdesi — OpenAI API formatı
    body = {
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_b64}"}
                },
                {
                    "type": "text",
                    "text": "Text Recognition:"   # GLM-OCR'nin resmi ORC promptu
                }
            ]
        }],
        "max_tokens": 1024,
        "temperature": 0.0   # Sadece gördüğünü yaz, yorum yapma
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GLM_OCR_TOKEN}"
    }

    try:
        response = requests.post(
            settings.GLM_OCR_API_URL,
            headers=headers,
            json=body,
            timeout=60
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"GLM-OCR HTTP {response.status_code}: {response.text[:200]}"
            )

        return response.json()["choices"][0]["message"]["content"]

    except requests.exceptions.Timeout:
        raise RuntimeError("GLM-OCR sunucusu 60 saniyede yanıt vermedi")
    except Exception as e:
        raise RuntimeError(f"GLM-OCR hatası: {e}")


# ─── Kod ve Metin Dosyaları ───────────────────────────────────────────────────

def _read_text_file(file_path: str) -> str:
    """
    .cpp, .h, .py, .txt gibi metin dosyalarını doğrudan okur.

    Neden bu kadar basit?
    Bu dosyalar zaten metin — OCR'a gerek yok.
    GPT C++ kodunu anlıyor ve "bu ne işe yarar, soru üret" diyebiliyoruz.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    # Dosyanın ne tür olduğunu GPT'ye belirt
    language_hint = {
        ".cpp": "C++", ".h": "C++ Header", ".c": "C",
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".java": "Java", ".cs": "C#",
        ".txt": "Text", ".md": "Markdown",
    }.get(suffix, "Code")

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
        logger.info(f"{language_hint} dosyası okundu: {len(content)} karakter")

        # GPT'ye dosyanın türünü söyle (daha iyi soru üretmesi için)
        return f"# {language_hint} Dosyası: {path.name}\n\n```{suffix.lstrip('.')}\n{content}\n```"

    except Exception as e:
        raise RuntimeError(f"Dosya okunamadı: {file_path} — {e}")


# ─── Tablo Yardımcısı ─────────────────────────────────────────────────────────

def _table_to_markdown(table: list) -> str:
    """
    pdfplumber'ın çıkardığı ham tabloyu Markdown tablo formatına dönüştürür.
    """
    if not table:
        return ""

    rows = []
    for i, row in enumerate(table):
        cells = [str(cell or "").strip().replace("\n", " ") for cell in row]
        rows.append("| " + " | ".join(cells) + " |")
        if i == 0:
            separator = "| " + " | ".join(["---"] * len(cells)) + " |"
            rows.append(separator)

    return "\n".join(rows)
