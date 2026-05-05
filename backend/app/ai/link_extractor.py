"""
Link content extractor.

Supports:
  1. YouTube — download audio with yt-dlp, transcribe with Whisper API
  2. Google Drive PDF — convert share URL to download URL, extract with pdfplumber
  3. Direct PDF URL — download and extract with pdfplumber
  4. Web page — scrape and clean text with BeautifulSoup
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

MAX_WHISPER_BYTES = 25 * 1024 * 1024   # 25 MB — Whisper API file size limit

MAX_TEXT_CHARS    = 200_000

# ── URL type detection ───────────────────────────────────────────────

def detect_url_type(url: str) -> str:

    """
    Classify a URL into one of four types:
      'youtube'       → YouTube or youtu.be links
      'google_drive'  → drive.google.com links
      'direct_pdf'    → URLs ending with .pdf
      'web_page'      → everything else
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

def _drive_to_download_url(url: str) -> str:

    """
    Convert a Google Drive share URL to a direct download URL.
    Handles /file/d/{id}/ share links and existing uc?id= links.
    Raises ValueError if the URL format is not recognized.
    """

    match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)

    if match:

        file_id = match.group(1)

        return f"https://drive.google.com/uc?export=download&id={file_id}"

    if "uc?id=" in url or "export=download" in url:

        return url

    raise ValueError(f"Unrecognized Google Drive URL format: {url}")

# ── YouTube → Transcript ─────────────────────────────────────────────────

def extract_text_from_youtube(url: str, openai_client: OpenAI) -> str:

    """
    Extract transcript text from a YouTube video.

    Strategy:
      1. Try to retrieve free auto-generated or uploaded captions (no API cost).
      2. If no captions are available, fall back to Whisper transcription (~$0.006/min).
    """

    try:

        import yt_dlp

    except ImportError:

        raise RuntimeError("yt-dlp not installed. Run: pip install yt-dlp")

    logger.info(f"Processing YouTube URL: {url}")

    try:

        text = _fetch_youtube_subtitles(url)

        if text:

            logger.info(f"YouTube captions retrieved (free): {len(text)} chars")

            return text

        logger.info("No captions found, switching to Whisper transcription...")

    except Exception as e:

        logger.warning(f"Caption retrieval failed ({e}), attempting Whisper...")

    return _fetch_with_whisper(url, openai_client)

def _fetch_youtube_subtitles(url: str) -> str:

    """
    Attempt to download free auto-generated or uploaded VTT captions from YouTube.
    Returns the cleaned caption text, or an empty string if no captions are found.
    """

    import yt_dlp

    import re

    with tempfile.TemporaryDirectory() as tmpdir:

        ydl_opts = {

            "skip_download": True,

            "writesubtitles": True,

            "writeautomaticsub": True,

            "subtitleslangs": ["tr", "en"],

            "subtitlesformat": "vtt",

            "outtmpl": os.path.join(tmpdir, "sub"),

            "quiet": True,

            "no_warnings": True,

        }

        title = "YouTube Video"

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:

            info = ydl.extract_info(url, download=True)

            title = info.get("title", title)

        vtt_file = None

        for fname in os.listdir(tmpdir):

            if fname.endswith(".vtt"):

                vtt_file = os.path.join(tmpdir, fname)

                break

        if not vtt_file:

            return ""

        # VTT → clean plain text (remove timestamps, tags, and duplicates)

        raw = open(vtt_file, encoding="utf-8").read()

        lines = raw.splitlines()

        clean_lines: list[str] = []

        for line in lines:

            line = line.strip()

            if (not line

                    or line.startswith("WEBVTT")

                    or line.startswith("NOTE")

                    or re.match(r"^\d{2}:\d{2}", line)   # timestamp

                    or re.match(r"^\d+$", line)):

                continue

            # Strip inline VTT tags (<c>, </c>, <00:00:00.000>, etc.)

            line = re.sub(r"<[^>]+>", "", line)

            if line and (not clean_lines or clean_lines[-1] != line):

                clean_lines.append(line)

        text = " ".join(clean_lines).strip()

        if len(text) < 100:

            return ""

        return f"# {title}\n\n{text}"

def _fetch_with_whisper(url: str, openai_client: OpenAI) -> str:

    """Download audio with yt-dlp and transcribe it using the Whisper API ($0.006/min)."""

    import yt_dlp

    logger.info("Starting Whisper transcription...")

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

            raise RuntimeError("Failed to download audio file.")

        file_size = os.path.getsize(audio_path)

        if file_size > MAX_WHISPER_BYTES:

            raise ValueError(f"Audio file too large ({file_size//(1024*1024)}MB). Exceeds 25MB limit.")

        logger.info(f"Sending to Whisper ({file_size//1024}KB)...")

        with open(audio_path, "rb") as f:

            transcript = openai_client.audio.transcriptions.create(

                model="whisper-1", file=f, response_format="text",

            )

        text = str(transcript).strip()

        if len(text) < 100:

            raise ValueError("Transcript too short.")

        return f"# {title}\n\n{text}"

# ── URL → Text ──────────────────────────────────────────────────────────────────────

def extract_text_from_url(url: str) -> str:

    """
    Extract text from a non-YouTube URL.

    Routing:
      - Google Drive PDF → convert to download URL, then extract with pdfplumber
      - Direct PDF URL   → download and extract with pdfplumber
      - Web page         → scrape and clean with BeautifulSoup
    """

    url_type = detect_url_type(url)

    if url_type == "google_drive":

        download_url = _drive_to_download_url(url)

        logger.info(f"Google Drive PDF: converting share URL and downloading")

        return _extract_from_pdf_url(download_url)

    if url_type == "direct_pdf":

        logger.info(f"Downloading PDF directly: {url}")

        return _extract_from_pdf_url(url)

    logger.info(f"Scraping web page: {url}")

    return _extract_from_html(url)

def _extract_from_pdf_url(pdf_url: str) -> str:

    """Download a PDF from a URL and extract text using pdfplumber."""

    import pdfplumber

    headers = {

        "User-Agent": "Mozilla/5.0 (compatible; ThinkCode/1.0)",

    }

    resp = requests.get(pdf_url, headers=headers, timeout=60, stream=True)

    resp.raise_for_status()

    content_type = resp.headers.get("content-type", "")

    if "html" in content_type and "pdf" not in content_type:

        if "google.com/sorry" in resp.url or "accounts.google" in resp.url:

            raise ValueError("Google Drive file is private — share it as 'Anyone with the link'.")

        raise ValueError(f"Expected PDF but received HTML. Is the URL a valid PDF link?")

    pdf_bytes = resp.content

    logger.info(f"PDF downloaded: {len(pdf_bytes) // 1024}KB")

    pages_text = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:

        for page in pdf.pages:

            text = page.extract_text() or ""

            if text.strip():

                pages_text.append(text)

    full_text = "\n\n".join(pages_text)

    if not full_text.strip():

        raise ValueError("Could not extract text from PDF. May be a scanned or image-based PDF.")

    return full_text[:MAX_TEXT_CHARS]

def _extract_from_html(url: str) -> str:

    """Download a web page and extract clean text using BeautifulSoup."""

    headers = {

        "User-Agent": "Mozilla/5.0 (compatible; ThinkCode/1.0)",

        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",

    }

    resp = requests.get(url, headers=headers, timeout=30)

    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):

        tag.decompose()

    main = (

        soup.find("article") or

        soup.find("main") or

        soup.find("div", {"id": re.compile(r"content|main|article", re.I)}) or

        soup.body

    )

    text = main.get_text(separator="\n") if main else soup.get_text(separator="\n")

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    clean_text = "\n".join(lines)

    logger.info(f"HTML scrape complete: {len(clean_text)} chars")

    return clean_text[:MAX_TEXT_CHARS]

# ── Main dispatch function ────────────────────────────────────────────────────────

def extract_text_from_link(url: str, openai_client: OpenAI) -> str:

    """
    Primary entry point: extract text from any supported URL type.

    Routes to the appropriate extractor based on detect_url_type():
      youtube       → extract_text_from_youtube (captions or Whisper)
      google_drive  → extract_text_from_url (PDF download)
      direct_pdf    → extract_text_from_url (pdfplumber)
      web_page      → extract_text_from_url (BeautifulSoup)
    """

    url_type = detect_url_type(url)

    logger.info(f"URL type: {url_type} → {url[:80]}...")

    if url_type == "youtube":

        return extract_text_from_youtube(url, openai_client)

    else:

        return extract_text_from_url(url)

