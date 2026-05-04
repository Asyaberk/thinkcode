"""

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

MIN_TEXT_CHARS = 50

# ─── Public API ──────────────────────────────────────────────────────────────

def extract_text_from_file(file_path: str) -> str:

    path = Path(file_path)

    if not path.exists():

        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()

    if suffix in PDF_EXTENSIONS:

        return _process_pdf(file_path)

    elif suffix in IMAGE_EXTENSIONS:

        return _ocr_image_file(file_path)

    elif suffix in CODE_EXTENSIONS:

        return _read_text_file(file_path)

    else:

        logger.warning(f"Unknown extension '{suffix}', reading as plain text.")

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

GLM_PAGE_TIMEOUT = 30

GLM_MAX_PAGES = 40

def _process_pdf(file_path: str) -> str:

    """

    """

    logger.info(f"Processing PDF (GLM-OCR primary): {file_path}")

    # 1. GLM-OCR (PRIMARY)

    try:

        text = _extract_pdf_with_glm_ocr(file_path)

        if text and len(text.strip()) >= MIN_TEXT_CHARS:

            logger.info(f"✓ GLM-OCR success: {len(text)} chars")

            return text

        logger.info("GLM-OCR returned too little text, trying pdfplumber fallback...")

    except Exception as e:

        logger.warning(f"GLM-OCR unavailable ({type(e).__name__}: {e}), switching to pdfplumber...")

    # 2. pdfplumber (FALLBACK)

    try:

        text = _extract_with_pdfplumber(file_path)

        if text and len(text.strip()) >= MIN_TEXT_CHARS:

            logger.info(f"✓ pdfplumber fallback success: {len(text)} chars")

            return text

        logger.warning("pdfplumber also found insufficient text.")

    except Exception as e:

        logger.warning(f"pdfplumber error: {e}")

    raise RuntimeError(

        "Could not read PDF: GLM-OCR server unreachable "

        "and pdfplumber extracted insufficient text (may be a scanned or image-based PDF)."

    )

def _extract_pdf_with_glm_ocr(file_path: str) -> str:

    """Convert PDF pages to images and send them to GLM-OCR for extraction."""

    try:

        from pdf2image import convert_from_path

    except ImportError:

        raise RuntimeError("pdf2image not installed: pip install pdf2image")

    logger.info("Converting PDF pages to images (dpi=100)...")

    pages = convert_from_path(file_path, dpi=100)

    total = len(pages)

    if total > GLM_MAX_PAGES:

        logger.warning(f"PDF has {total} pages — processing first {GLM_MAX_PAGES} (limit: {GLM_MAX_PAGES}).")

        pages = pages[:GLM_MAX_PAGES]

    logger.info(f"{len(pages)}/{total} pages will be processed by GLM-OCR")

    all_text: list[str] = []

    failed_pages = 0

    for i, page_img in enumerate(pages, start=1):

        logger.info(f"  Sayfa {i}/{len(pages)} → GLM-OCR...")

        try:

            text = _send_image_to_glm_ocr(page_img)

            all_text.append(f"## Sayfa {i}\n\n{text}")

        except Exception as e:

            logger.warning(f"  Page {i} GLM-OCR error: {e}")

            all_text.append(f"## Page {i}\n\n[Unreadable]")

            failed_pages += 1

            if i <= 3 and failed_pages >= i:

                raise RuntimeError(f"GLM-OCR server unresponsive (first {i} pages failed)")

    return "\n\n".join(all_text)

def _send_image_to_glm_ocr(pil_image) -> str:

    """Send a PIL image to the GLM-OCR API endpoint for OCR processing."""

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

    resp = requests.post(settings.GLM_OCR_API_URL, headers=headers, json=body, timeout=GLM_PAGE_TIMEOUT)

    if resp.status_code != 200:

        raise RuntimeError(f"GLM-OCR HTTP {resp.status_code}: {resp.text[:200]}")

    return resp.json()["choices"][0]["message"]["content"]

def _extract_with_pdfplumber(file_path: str) -> str:

    """Extract text from text-embedded PDFs using pdfplumber."""

    try:

        import pdfplumber

    except ImportError:

        logger.warning("pdfplumber not installed, skipping.")

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

        logger.error(f"pdfplumber error: {e}")

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

def _ocr_image_file(file_path: str) -> str:

    """Process PNG/JPG images through GLM-OCR and return extracted text."""

    from PIL import Image

    img = Image.open(file_path)

    return _send_image_to_glm_ocr(img)

def _read_text_file(file_path: str) -> str:

    """Read plain text source files (C++, Python, Markdown, etc.) directly."""

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

        return f"# {language_hint} File: {path.name}\n\n```{suffix.lstrip('.')}\n{content}\n```"

    except Exception as e:

        raise RuntimeError(f"Failed to read file: {file_path} — {e}")

