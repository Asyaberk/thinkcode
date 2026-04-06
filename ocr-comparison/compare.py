"""
compare.py - pdfplumber vs GLM karşılaştırması

NE YAPIYOR?
  Aynı PDF'i iki farklı yöntemle okur:
    1. pdfplumber: PDF'in içindeki metni direkt çeker (AI yok, hızlı)
    2. GLM:        Her sayfayı görüntüye çevirip Mert'in sunucusuna gönderir (AI var, yavaş)

  Her iki yöntem için:
    - Kaç saniye sürdü? (hız)
    - Kaç karakter metin çıktı? (miktar)
    - Metin kalitesi nasıl görünüyor?

  Sonuçlar ekrana ve iki ayrı dosyaya kaydedilir:
    results/pdfplumber_output.txt
    results/glm_output.txt

KULLANIM:
  python3 compare.py
"""

import time
import base64
import os
import requests
from io import BytesIO
from pdf2image import convert_from_path
import pdfplumber
from config import GLM_OCR_API_URL, GLM_OCR_TOKEN  # .env'den okunuyor

# ─── AYARLAR ───────────────────────────────────────────────────────────────────

PDF_PATH = "1.1-intro-preprocessor.pdf"
MAX_PAGES = 5

# GLM sunucu ayarları — artık .env'den okunuyor (config.py)
GLM_API_URL    = GLM_OCR_API_URL
GLM_AUTH_TOKEN = GLM_OCR_TOKEN

os.makedirs("results", exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# YÖNTEM 1: pdfplumber
# ═══════════════════════════════════════════════════════════════════════════════

def run_pdfplumber(max_pages):
    """
    pdfplumber ile PDF'den metin çeker.

    pdfplumber nasıl çalışır?
      PDF dosyalarının içinde metin iki şekilde saklanabilir:
        a) "Gömülü metin" - Word'de yazılıp kaydedilmiş gibi, metin direkt var
        b) "Görüntü" - tarayıcıdan geçirilmiş, metin yok sadece resim var

      pdfplumber sadece (a) türü PDF'leri okuyabilir.
      Eğer PDF taranmışsa (b türü) boş döner.
    """
    print("\n" + "─" * 50)
    print("YÖNTEM 1: pdfplumber")
    print("─" * 50)

    start_time = time.time()   # sayacı başlat

    all_text = []

    with pdfplumber.open(PDF_PATH) as pdf:
        total = min(max_pages, len(pdf.pages))
        print(f"  {total} sayfa okunuyor...")

        for i, page in enumerate(pdf.pages[:max_pages], start=1):
            # extract_text(): sayfadaki gömülü metni çeker
            text = page.extract_text() or ""
            all_text.append(f"--- SAYFA {i} ---\n{text}\n")
            print(f"  ✓ Sayfa {i}: {len(text)} karakter")

    elapsed = time.time() - start_time   # geçen süre

    combined = "\n".join(all_text)
    total_chars = len(combined)

    # Sonucu dosyaya kaydet
    with open("results/pdfplumber_output.txt", "w", encoding="utf-8") as f:
        f.write(combined)

    print(f"\n  ⏱  Süre: {elapsed:.2f} saniye")
    print(f"  📝 Toplam: {total_chars} karakter")
    print(f"  💾 Kaydedildi: results/pdfplumber_output.txt")

    return elapsed, total_chars, combined


# ═══════════════════════════════════════════════════════════════════════════════
# YÖNTEM 2: GLM (Mert'in sunucusu)
# ═══════════════════════════════════════════════════════════════════════════════

def image_to_base64(pil_image):
    """PIL görüntüsünü base64 string'e çevirir."""
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def ocr_one_page_glm(pil_image, page_num):
    """Tek sayfayı GLM'e gönderir, metni döndürür."""
    img_b64 = image_to_base64(pil_image)

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
                    # GLM-OCR resmi promptu — dökümandan alındı
                    "text": "Text Recognition:"
                }
            ]
        }],
        "max_tokens": 1024,
        "temperature": 0.0
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GLM_AUTH_TOKEN}"
    }

    try:
        resp = requests.post(GLM_API_URL, headers=headers, json=body, timeout=60)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        else:
            print(f"  ✗ Sayfa {page_num} HATA: {resp.status_code} - {resp.text[:100]}")
            return ""
    except Exception as e:
        print(f"  ✗ Sayfa {page_num} HATA: {e}")
        return ""


def run_glm(max_pages):
    """
    GLM ile PDF'den metin çeker.

    GLM nasıl çalışır?
      1. Her PDF sayfası önce görüntüye dönüştürülür (pdf2image)
      2. Görüntü base64'e çevrilir
      3. Mert'in sunucusuna HTTP isteği gönderilir
      4. Sunucu "bu görüntüde şunlar yazıyor..." der

    Her sayfa için sunucuya gidip geliyor → yavaş ama
    görüntü bazlı sayfaları da okuyabiliyor.
    """
    print("\n" + "─" * 50)
    print("YÖNTEM 2: GLM (Mert'in sunucusu)")
    print("─" * 50)

    start_time = time.time()

    # PDF sayfalarını görüntüye çevir (dpi=72: token limitini aşmamak için)
    print(f"  PDF görüntüye çevriliyor (dpi=72)...")
    pages = convert_from_path(PDF_PATH, dpi=72)
    pages = pages[:max_pages]
    print(f"  {len(pages)} sayfa GLM'e gönderiliyor...")

    all_text = []
    for i, page in enumerate(pages, start=1):
        print(f"  → Sayfa {i} gönderiliyor...", end=" ", flush=True)
        page_start = time.time()
        text = ocr_one_page_glm(page, i)
        page_elapsed = time.time() - page_start
        all_text.append(f"--- SAYFA {i} ---\n{text}\n")
        print(f"✓ {len(text)} karakter ({page_elapsed:.1f}s)")

    elapsed = time.time() - start_time

    combined = "\n".join(all_text)
    total_chars = len(combined)

    with open("results/glm_output.txt", "w", encoding="utf-8") as f:
        f.write(combined)

    print(f"\n  ⏱  Süre: {elapsed:.2f} saniye")
    print(f"  📝 Toplam: {total_chars} karakter")
    print(f"  💾 Kaydedildi: results/glm_output.txt")

    return elapsed, total_chars, combined


# ═══════════════════════════════════════════════════════════════════════════════
# KARŞILAŞTIRMA RAPORU
# ═══════════════════════════════════════════════════════════════════════════════

def print_comparison(pdf_time, pdf_chars, glm_time, glm_chars):
    """Her iki yöntemin sonuçlarını yan yana gösterir."""

    print("\n" + "═" * 50)
    print("KARŞILAŞTIRMA SONUÇLARI")
    print("═" * 50)
    print(f"{'':25} {'pdfplumber':>10} {'GLM':>10}")
    print("─" * 50)
    print(f"{'Süre (saniye)':25} {pdf_time:>10.2f} {glm_time:>10.2f}")
    print(f"{'Çıkarılan karakter':25} {pdf_chars:>10} {glm_chars:>10}")
    print(f"{'Hız (kat farkı)':25} {'1x (baz)':>10} {glm_time/pdf_time:>9.1f}x")
    print("═" * 50)

    # Yorumlar
    print("\nDEĞERLENDİRME:")
    if pdf_chars < 100:
        print("  ⚠ pdfplumber çok az metin buldu.")
        print("    → Bu PDF muhtemelen görüntü tabanlı (taranmış veya slayt).")
        print("    → GLM bu tür PDF'ler için daha uygun.")
    else:
        print(f"  ✓ pdfplumber {pdf_chars} karakter buldu — metin tabanlı PDF.")

    if glm_time > pdf_time * 5:
        print(f"  ⚡ pdfplumber, GLM'den {glm_time/pdf_time:.0f}x daha hızlı.")
        print("    → İnternet bağlantısı gerektirmiyor, sunucuya bağımlı değil.")
    
    print("\n  💡 SONUÇ:")
    print("    • Metin tabanlı PDF → pdfplumber yeterli (hızlı, bedava)")
    print("    • Görüntü/slayt PDF → GLM gerekli (yavaş ama okuyabilir)")
    print("    • Video/ses → farklı araç gerekiyor (Whisper gibi)")


# ─── ANA PROGRAM ───────────────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print(f"OCR KARŞILAŞTIRMA TESTİ")
    print(f"PDF: {PDF_PATH}")
    print(f"Test edilecek sayfa: {MAX_PAGES}")
    print("=" * 50)

    if not os.path.exists(PDF_PATH):
        print(f"HATA: {PDF_PATH} bulunamadı!")
        return

    # Her iki yöntemi çalıştır
    pdf_time, pdf_chars, _ = run_pdfplumber(MAX_PAGES)
    glm_time, glm_chars, _ = run_glm(MAX_PAGES)

    # Karşılaştır
    print_comparison(pdf_time, pdf_chars, glm_time, glm_chars)


if __name__ == "__main__":
    main()
