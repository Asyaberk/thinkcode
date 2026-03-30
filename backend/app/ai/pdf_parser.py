"""
pdf_parser.py — PDF'den Markdown metin cikartma modulu

Kamer Hoca'nin istedigi pipeline'in birinci adimi:
  Hoca PDF yukler → bu modul metni cikarir → GPT'ye gonderilir

Strateji:
  1. Oncelikle pdfplumber kullanilir (GPU gerektirmez, her ortamda calisir)
  2. Chandra OCR CLI kuruluysa o kullanilir (daha yuksek kalite, tablo/matematik icin)
     Ama Chandra model indir gerektirir; uretim icin pdfplumber yeterlidir.

Cikti formati: str (Markdown formati, basliklar/tablolar korunur)
"""

import os
import io
import logging
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """
    PDF dosyasindan metin cikarir.

    Once Chandra CLI'yi dener; bulunamazsa pdfplumber fallback'ine gecer.

    Args:
        file_path: Sunucudaki PDF dosyasinin tam yolu

    Returns:
        str: Markdown formatinda cikarilmis metin
    
    Raises:
        ValueError: Dosya PDF degilse
        RuntimeError: Her iki yontem de basarisiz olursa
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF bulunamadi: {file_path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Desteklenmeyen dosya turu: {path.suffix}. Sadece PDF kabul edilir.")

    # Chandra CLI kuruluysa onu kullan (daha iyi kalite)
    if _chandra_available():
        logger.info("Chandra CLI bulundu, kullaniliyor...")
        try:
            return _extract_with_chandra(file_path)
        except Exception as e:
            logger.warning(f"Chandra basarisiz oldu, pdfplumber'a geciliyor: {e}")

    # Fallback: pdfplumber (guvenilir, GPU'suz)
    logger.info("pdfplumber ile metin cikartiliyor...")
    return _extract_with_pdfplumber(file_path)


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Bellek icindeki PDF byte'larindan metin cikarir.
    
    Upload endpoint'inden dogrudan bytes geldiginde kullanilir;
    gecici dosya olusturulur, islenir, silinir.

    Args:
        file_bytes: PDF iceriginin byte dizisi
        filename:   Log amacli orijinal dosya adi

    Returns:
        str: Markdown formatinda metin
    """
    # Gecici dosya olustur (islem bittikten sonra otomatik silinir)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        return extract_text_from_pdf(tmp_path)
    finally:
        # Gecici dosyayi her durumda temizle
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── Dahili yardimci fonksiyonlar ────────────────────────────────────────────

def _chandra_available() -> bool:
    """
    Sistemde 'chandra' CLI aracinin kurulu olup olmadigini kontrol eder.
    Chandra kurulumu: pip install chandra-ocr
    """
    try:
        result = subprocess.run(
            ["chandra", "--version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _extract_with_chandra(file_path: str) -> str:
    """
    Chandra OCR CLI ile PDF'den Markdown cikarir.
    
    Chandra hakkinda:
      - Datalab tarafindan gelistirilmis, SOTA OCR modeli
      - Tablo, matematik, cok sutun duzeni icin mukemmel
      - Kurulum: pip install chandra-ocr (vLLM icin GPU onerilir)
      - Referans: https://huggingface.co/datalab-to/chandra-ocr-2
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Chandra: chandra <input.pdf> <output_dir>
        result = subprocess.run(
            ["chandra", file_path, tmp_dir],
            capture_output=True,
            text=True,
            timeout=300,  # 5 dakika max (buyuk PDF'ler icin)
        )

        if result.returncode != 0:
            raise RuntimeError(f"Chandra hata verdi: {result.stderr}")

        # Chandra ciktisi: output_dir/output.md
        output_md = Path(tmp_dir) / "output.md"
        if not output_md.exists():
            # Alternatif: ilk .md dosyasini bul
            md_files = list(Path(tmp_dir).glob("*.md"))
            if not md_files:
                raise RuntimeError("Chandra MD dosyasi uretmedi")
            output_md = md_files[0]

        return output_md.read_text(encoding="utf-8")


def _extract_with_pdfplumber(file_path: str) -> str:
    """
    pdfplumber kutuphanesi ile PDF'den metin cikarir.

    pdfplumber secilmesinin nedeni:
      - GPU gerektirmez, her ortamda calisir
      - Tablo algilama destegi var
      - PyMuPDF'e gore daha temiz metin ciktisi

    Cikarilan metin basit Markdown'a donusturulur:
      - Sayfa basliklari h2 olarak isaretlen
      - Tablolar ASCII format korunur
    """
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError(
            "pdfplumber yuklu degil. "
            "Yuklemek icin: pip install pdfplumber"
        )

    pages_text = []

    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)
        logger.info(f"PDF acildi: {total_pages} sayfa")

        for i, page in enumerate(pdf.pages, start=1):
            # Sayfa numarasi baslik olarak ekle (Markdown h2)
            page_header = f"\n\n## Sayfa {i}\n\n"

            # Once tablo var mi bak (tablo tespit edilirse CSV formatinda al)
            tables = page.extract_tables()
            if tables:
                text_parts = [page_header]
                # Tabloyu Markdown tablosuna donustur
                for table in tables:
                    text_parts.append(_table_to_markdown(table))
                # Tablolarin disindaki metni de al
                raw_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                if raw_text.strip():
                    text_parts.append(raw_text)
                pages_text.append("\n".join(text_parts))
            else:
                # Normal metin sayfasi
                raw_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                pages_text.append(page_header + raw_text)

    full_text = "\n".join(pages_text)

    if not full_text.strip():
        raise RuntimeError(
            "PDF'den metin cikarilamadi. "
            "Taranmis/goruntu tabanli PDF olabilir. "
            "Chandra OCR (GPU) gerekebilir."
        )

    return full_text


def _table_to_markdown(table: list) -> str:
    """
    pdfplumber'in cikarttigi ham tabloyu Markdown tablo formatina donusturur.

    Args:
        table: list of list — her satir bir liste, her eleman bir hucre

    Returns:
        str: Markdown tablo formati
    """
    if not table:
        return ""

    rows = []
    for i, row in enumerate(table):
        # None hucreleri bos stringe donustur
        cells = [str(cell or "").strip().replace("\n", " ") for cell in row]
        rows.append("| " + " | ".join(cells) + " |")

        # Baslik satirindan sonra ayirici ekle (standart Markdown)
        if i == 0:
            separator = "| " + " | ".join(["---"] * len(cells)) + " |"
            rows.append(separator)

    return "\n".join(rows)
