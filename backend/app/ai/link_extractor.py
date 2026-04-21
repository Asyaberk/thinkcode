"""
link_extractor.py — Harici URL kaynaklarından içerik çıkarma

Desteklenen kaynak türleri:
  1. YouTube — yt-dlp ile ses indir, Whisper API ile transkript al
  2. Google Drive PDF (public) — doğrudan indir, pdfplumber ile metin çek
  3. Doğrudan PDF URL — indir, pdfplumber ile metin çek
  4. Web sayfası (HTML) — BeautifulSoup ile temiz metin çek

Ardından mevcut extract_content_from_markdown() pipeline'ına gönderilir.
"""
import io
import logging
import os
import re
import tempfile
from typing import Optional
from urllib.parse import urlparse, parse_qs

import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MAX_WHISPER_BYTES = 25 * 1024 * 1024   # 25MB — Whisper API limiti
MAX_TEXT_CHARS    = 200_000             # GPT context limiti için kırp


# ── URL Tipi Tespiti ─────────────────────────────────────────────────────────

def detect_url_type(url: str) -> str:
    """
    URL'ye bakarak kaynak türünü döner:
      'youtube'        → YouTube veya youtu.be linkleri
      'google_drive'   → drive.google.com linkleri
      'direct_pdf'     → .pdf ile biten URL'ler
      'web_page'       → diğer tüm HTTP sayfaları
    """
    parsed = urlparse(url.lower())
    host = parsed.netloc.replace("www.", "")

    if host in ("youtube.com", "youtu.be") or "youtube" in host:
        return "youtube"
    if "drive.google.com" in host:
        return "google_drive"
    if parsed.path.endswith(".pdf"):
        return "direct_pdf"
    return "web_page"


# ── Google Drive URL Dönüşümü ────────────────────────────────────────────────

def _drive_to_download_url(url: str) -> str:
    """
    Google Drive görüntüleme linkini doğrudan indirme linkine çevirir.
    Sadece "Anyone with the link" paylaşımlı dosyalar için çalışır.
    
    Örnek giriş:  https://drive.google.com/file/d/1aBcDeFgH/view
    Örnek çıkış:  https://drive.google.com/uc?export=download&id=1aBcDeFgH
    """
    # /file/d/{FILE_ID}/view formatı
    match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    if match:
        file_id = match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    # Zaten uc?id= formatındaysa olduğu gibi döndür
    if "uc?id=" in url or "export=download" in url:
        return url
    raise ValueError(f"Google Drive URL formatı tanınamadı: {url}")


# ── YouTube → Transkript ─────────────────────────────────────────────────────

def extract_text_from_youtube(url: str, openai_client: OpenAI) -> str:
    """
    YouTube'dan transkript çeker.

    Maliyet-öncelikli sıra:
      1. YouTube altyazı/subtitle (yt-dlp ile — TAMAMEN ÜCRETSİZ)
         - Türkçe → İngilizce → oto-oluşturulmuş herhangi bir dil
      2. Whisper API (sadece hiç altyazı yoksa — $0.006/dakika)

    Çoğu eğitim videosu YouTube'un otomatik altyazısına sahiptir.
    Whisper sadece altyazısı olmayan videolar için tetiklenir.
    """
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp kurulu değil. `pip install yt-dlp` ile kurun.")

    logger.info(f"YouTube işleniyor: {url}")

    # ── 1. Ücretsiz altyazı dene ─────────────────────────────────────────────
    try:
        text = _fetch_youtube_subtitles(url)
        if text:
            logger.info(f"YouTube altyazısı alındı (ücretsiz): {len(text)} karakter")
            return text
        logger.info("Altyazı bulunamadı, Whisper'a geçiliyor...")
    except Exception as e:
        logger.warning(f"Altyazı çekilemedi ({e}), Whisper deneniyor...")

    # ── 2. Whisper (fallback — ücretli) ──────────────────────────────────────
    return _fetch_with_whisper(url, openai_client)


def _fetch_youtube_subtitles(url: str) -> str:
    """
    yt-dlp ile YouTube'un kendi altyazılarını indirir (ücretsiz).

    Öncelik: tr → en → oto-oluşturulmuş (tr veya en)
    VTT formatındaki altyazıyı temiz metne dönüştürür.
    """
    import yt_dlp
    import re

    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            "skip_download": True,           # Video/ses indirme — sadece altyazı
            "writesubtitles": True,          # Manuel altyazı
            "writeautomaticsub": True,       # Otomatik oluşturulmuş altyazı
            "subtitleslangs": ["tr", "en"],  # Önce Türkçe, sonra İngilizce
            "subtitlesformat": "vtt",
            "outtmpl": os.path.join(tmpdir, "sub"),
            "quiet": True,
            "no_warnings": True,
        }

        title = "YouTube Video"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", title)

        # İndirilen .vtt dosyasını bul
        vtt_file = None
        for fname in os.listdir(tmpdir):
            if fname.endswith(".vtt"):
                vtt_file = os.path.join(tmpdir, fname)
                break

        if not vtt_file:
            return ""  # Altyazı yok → Whisper'a düş

        # VTT → Temiz metin
        raw = open(vtt_file, encoding="utf-8").read()
        # Timestamp satırlarını ve WEBVTT başlığını kaldır
        lines = raw.splitlines()
        clean_lines: list[str] = []
        for line in lines:
            line = line.strip()
            if (not line
                    or line.startswith("WEBVTT")
                    or line.startswith("NOTE")
                    or re.match(r"^\d{2}:\d{2}", line)   # timestamp
                    or re.match(r"^\d+$", line)):         # satır numarası
                continue
            # HTML tag'lerini temizle (<c>, </c>, <00:00:00.000> vb.)
            line = re.sub(r"<[^>]+>", "", line)
            if line and (not clean_lines or clean_lines[-1] != line):
                clean_lines.append(line)

        text = " ".join(clean_lines).strip()
        if len(text) < 100:
            return ""  # Çok kısa → Whisper'a düş

        return f"# {title}\n\n{text}"


def _fetch_with_whisper(url: str, openai_client: OpenAI) -> str:
    """Ses indir → Whisper API ile transkript al ($0.006/dakika)."""
    import yt_dlp

    logger.info("Whisper transkripti başlatılıyor (ücretli)...")

    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"),
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "64"}],
            "quiet": True,
            "no_warnings": True,
            "max_filesize": MAX_WHISPER_BYTES,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "YouTube Video")

        audio_path = next(
            (os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.startswith("audio")),
            None,
        )
        if not audio_path:
            raise RuntimeError("Ses dosyası indirilemedi.")

        file_size = os.path.getsize(audio_path)
        if file_size > MAX_WHISPER_BYTES:
            raise ValueError(f"Ses dosyası çok büyük ({file_size//(1024*1024)}MB). 25MB limitini aşıyor.")

        logger.info(f"Whisper'a gönderiliyor ({file_size//1024}KB)...")
        with open(audio_path, "rb") as f:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1", file=f, response_format="text",
            )

        text = str(transcript).strip()
        if len(text) < 100:
            raise ValueError("Transkript çok kısa.")
        return f"# {title}\n\n{text}"


# ── URL → Metin ──────────────────────────────────────────────────────────────

def extract_text_from_url(url: str) -> str:
    """
    Genel URL'den metin çeker:
    - PDF URL → pdfplumber ile sayfa metni
    - Google Drive PDF → indirip pdfplumber
    - HTML sayfası → BeautifulSoup ile temiz metin
    """
    url_type = detect_url_type(url)

    if url_type == "google_drive":
        download_url = _drive_to_download_url(url)
        logger.info(f"Google Drive PDF indiriliyor: {download_url}")
        return _extract_from_pdf_url(download_url)

    if url_type == "direct_pdf":
        logger.info(f"Doğrudan PDF indiriliyor: {url}")
        return _extract_from_pdf_url(url)

    # Web sayfası
    logger.info(f"Web sayfası scrape ediliyor: {url}")
    return _extract_from_html(url)


def _extract_from_pdf_url(pdf_url: str) -> str:
    """PDF URL'sini indirir ve pdfplumber ile metin çıkarır."""
    import pdfplumber

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ThinkCode/1.0)",
    }
    resp = requests.get(pdf_url, headers=headers, timeout=60, stream=True)
    resp.raise_for_status()

    # Content-Type kontrolü
    content_type = resp.headers.get("content-type", "")
    if "html" in content_type and "pdf" not in content_type:
        # Drive bazen HTML döner (quota exceeded veya private dosya)
        if "google.com/sorry" in resp.url or "accounts.google" in resp.url:
            raise ValueError("Google Drive dosyası özel — 'Anyone with the link' olarak paylaşın.")
        raise ValueError(f"Beklenen PDF ama HTML geldi. URL geçerli bir PDF linki mi?")

    pdf_bytes = resp.content
    logger.info(f"PDF indirildi: {len(pdf_bytes) // 1024}KB")

    pages_text = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(text)

    full_text = "\n\n".join(pages_text)
    if not full_text.strip():
        raise ValueError("PDF'den metin çıkarılamadı. Taranmış görüntü tabanlı PDF olabilir.")

    return full_text[:MAX_TEXT_CHARS]


def _extract_from_html(url: str) -> str:
    """Web sayfasını indirir ve BeautifulSoup ile temiz metin çıkarır."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ThinkCode/1.0)",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Gereksiz etiketleri kaldır
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    # Ana içerik bloğunu bul (article > main > body sırası)
    main = (
        soup.find("article") or
        soup.find("main") or
        soup.find("div", {"id": re.compile(r"content|main|article", re.I)}) or
        soup.body
    )

    text = main.get_text(separator="\n") if main else soup.get_text(separator="\n")
    # Boş satırları temizle
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    clean_text = "\n".join(lines)

    logger.info(f"HTML scrape tamamlandı: {len(clean_text)} karakter")
    return clean_text[:MAX_TEXT_CHARS]


# ── Ana Dispatch Fonksiyonu ──────────────────────────────────────────────────

def extract_text_from_link(url: str, openai_client: OpenAI) -> str:
    """
    URL tipine göre doğru extractor'ı çağırır ve metin döner.
    Bu metin daha sonra extract_content_from_markdown() pipeline'ına gider.
    
    Fırlatabilir:
      RuntimeError: yt-dlp kurulu değilse
      ValueError: desteklenmeyen format, özel Drive dosyası, vb.
      requests.HTTPError: ağ hatası
    """
    url_type = detect_url_type(url)
    logger.info(f"URL tipi: {url_type} → {url[:80]}...")

    if url_type == "youtube":
        return extract_text_from_youtube(url, openai_client)
    else:
        return extract_text_from_url(url)
