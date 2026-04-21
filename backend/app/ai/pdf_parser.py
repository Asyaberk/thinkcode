"""
pdf_parser.py — Akıllı Dosya Okuyucu (Maliyet-Öncelikli)

Pipeline (en ucuzdan en pahalıya):
  .pdf  → 1. GLM-OCR (Mert'in sunucusu — ücretsiz)
          2. pdfplumber (lokal — ücretsiz, fallback)
  .png/.jpg → GLM-OCR → pdfplumber imkânsız → hata
  .cpp/.py/.txt/.md → Doğrudan oku (her zaman ücretsiz)

OpenAI Vision KULLANILMIYOR (maliyetli).
"""

import os
import base64
import logging
import tempfile
from pathlib import Path
from io import BytesIO

import requests

logger = logging.getLogger(__name__)

PDF_EXTENSIONS   = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
CODE_EXTENSIONS  = {
    ".cpp", ".h", ".c", ".cc",
    ".py", ".js", ".ts", ".java", ".cs",
    ".txt", ".md",
}

# pdfplumber fallback için minimum karakter eşiği
MIN_TEXT_CHARS = 50


# ─── Public API ──────────────────────────────────────────────────────────────

def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")
    suffix = path.suffix.lower()
    if suffix in PDF_EXTENSIONS:
        return _process_pdf(file_path)
    elif suffix in IMAGE_EXTENSIONS:
        return _ocr_image_file(file_path)
    elif suffix in CODE_EXTENSIONS:
        return _read_text_file(file_path)
    else:
        logger.warning(f"Bilinmeyen uzantı '{suffix}', metin olarak okunuyor.")
        return _read_text_file(file_path)


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
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


# ─── PDF Pipeline ─────────────────────────────────────────────────────────────

def _process_pdf(file_path: str) -> str:
    """
    PDF'i önce GLM-OCR (ücretsiz) ile, başarısız olursa pdfplumber ile okur.

    Neden bu sıra?
      - GLM-OCR: Mert'in sunucusu, ücretsiz, taranmış PDF'leri de okur
      - pdfplumber: Lokal, ücretsiz, sadece metin gömülü PDF'lerde çalışır
      - OpenAI Vision: KULLANILMIYOR (maliyetli)
    """
    logger.info(f"PDF işleniyor: {file_path}")

    # 1. GLM-OCR (primary — ücretsiz)
    try:
        text = _extract_pdf_with_glm_ocr(file_path)
        if text and len(text.strip()) >= MIN_TEXT_CHARS:
            logger.info(f"GLM-OCR başarılı: {len(text)} karakter")
            return text
        logger.info("GLM-OCR az metin döndürdü, pdfplumber deneniyor...")
    except Exception as e:
        logger.warning(f"GLM-OCR başarısız ({e}), pdfplumber'a geçiliyor...")

    # 2. pdfplumber (fallback — ücretsiz, lokal)
    try:
        text = _extract_with_pdfplumber(file_path)
        if text and len(text.strip()) >= MIN_TEXT_CHARS:
            logger.info(f"pdfplumber başarılı: {len(text)} karakter")
            return text
    except Exception as e:
        logger.warning(f"pdfplumber hatası: {e}")

    raise RuntimeError(
        "PDF okunamadı: GLM-OCR sunucusu erişilemez ve pdfplumber yeterli metin bulamadı."
    )


# ─── GLM-OCR (Mert'in sunucusu, ücretsiz) ────────────────────────────────────

def _extract_pdf_with_glm_ocr(file_path: str) -> str:
    """PDF sayfalarını görüntüye çevirip GLM-OCR'a gönderir."""
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise RuntimeError("pdf2image yüklü değil: pip install pdf2image")

    logger.info("PDF sayfaları görüntüye çevriliyor (dpi=100)...")
    pages = convert_from_path(file_path, dpi=100)
    logger.info(f"{len(pages)} sayfa")

    all_text: list[str] = []
    for i, page_img in enumerate(pages, start=1):
        logger.info(f"  Sayfa {i}/{len(pages)} GLM-OCR...")
        try:
            text = _send_image_to_glm_ocr(page_img)
            all_text.append(f"## Sayfa {i}\n\n{text}")
        except Exception as e:
            logger.warning(f"  Sayfa {i} GLM-OCR hatası: {e}")
            all_text.append(f"## Sayfa {i}\n\n[Okunamadı]")

    return "\n\n".join(all_text)


def _send_image_to_glm_ocr(pil_image) -> str:
    """PIL görüntüsünü Mert'in GLM-OCR sunucusuna gönderir."""
    from app.core.config import settings

    buf = BytesIO()
    pil_image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    body = {
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                {"type": "text", "text": "Text Recognition:"},
            ],
        }],
        "max_tokens": 1024,
        "temperature": 0.0,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GLM_OCR_TOKEN}",
    }
    resp = requests.post(settings.GLM_OCR_API_URL, headers=headers, json=body, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"GLM-OCR HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


# ─── pdfplumber fallback (lokal, ücretsiz) ────────────────────────────────────

def _extract_with_pdfplumber(file_path: str) -> str:
    """Metin gömülü PDF'lerden pdfplumber ile metin çıkarır."""
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber yüklü değil, atlanıyor.")
        return ""

    pages_text: list[str] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            logger.info(f"pdfplumber: {len(pdf.pages)} sayfa")
            for i, page in enumerate(pdf.pages, start=1):
                raw = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                tables = page.extract_tables()
                if tables:
                    tbl_md = "\n".join(_table_to_markdown(t) for t in tables)
                    pages_text.append(f"\n\n## Sayfa {i}\n\n{tbl_md}\n\n{raw}")
                else:
                    pages_text.append(f"\n\n## Sayfa {i}\n\n{raw}")
    except Exception as e:
        logger.error(f"pdfplumber hatası: {e}")
        return ""

    return "\n".join(pages_text)


def _table_to_markdown(table: list) -> str:
    if not table:
        return ""
    rows = []
    for i, row in enumerate(table):
        cells = [str(cell or "").strip().replace("\n", " ") for cell in row]
        rows.append("| " + " | ".join(cells) + " |")
        if i == 0:
            rows.append("| " + " | ".join(["---"] * len(cells)) + " |")
    return "\n".join(rows)


# ─── Görüntü Dosyası ──────────────────────────────────────────────────────────

def _ocr_image_file(file_path: str) -> str:
    """PNG/JPG dosyalarını GLM-OCR ile okur."""
    from PIL import Image
    img = Image.open(file_path)
    return _send_image_to_glm_ocr(img)


# ─── Metin/Kod Dosyaları ──────────────────────────────────────────────────────

def _read_text_file(file_path: str) -> str:
    """C++, Python, Markdown vb. metin dosyalarını doğrudan okur."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    language_hint = {
        ".cpp": "C++", ".h": "C++ Header", ".c": "C",
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".java": "Java", ".cs": "C#",
        ".txt": "Text", ".md": "Markdown",
    }.get(suffix, "Code")
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
        logger.info(f"{language_hint} okundu: {len(content)} karakter")
        return f"# {language_hint} Dosyası: {path.name}\n\n```{suffix.lstrip('.')}\n{content}\n```"
    except Exception as e:
        raise RuntimeError(f"Dosya okunamadı: {file_path} — {e}")
