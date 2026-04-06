"""
test_image.py - Görüntü dosyasını GLM-OCR ile okuma testi

PDF'den farklı olarak burada:
  - Sayfalara bölme yok (zaten tek görüntü)
  - pdf2image'a gerek yok
  - Direkt PNG dosyasını base64'e çevirip gönderiyoruz

El yazısı, taranmış belge, fotoğraf — hepsi bu şekilde test edilebilir.

KULLANIM:
  python3 test_image.py
"""

import base64
import requests
from config import GLM_OCR_API_URL, GLM_OCR_TOKEN  # .env'den okunuyor

# ─── AYARLAR ───────────────────────────────────────────────────────
IMAGE_PATH  = "image.png"
GLM_API_URL = GLM_OCR_API_URL
GLM_TOKEN   = GLM_OCR_TOKEN

# ─── 1. Görüntüyü oku ve base64'e çevir ───────────────────────────
print(f"Görüntü okunuyor: {IMAGE_PATH}")

with open(IMAGE_PATH, "rb") as f:
    image_bytes = f.read()

# base64: görüntünün byte'larını sadece harflerden oluşan metne çeviriyor
# "data:image/png;base64," ön eki → sunucuya "bu bir PNG görüntüsü" diyor
image_b64 = base64.b64encode(image_bytes).decode("utf-8")
print(f"Görüntü boyutu: {len(image_bytes)/1024:.1f} KB")
print(f"Base64 boyutu: {len(image_b64)/1024:.1f} KB\n")

# ─── 2. GLM-OCR'a gönder ──────────────────────────────────────────
print("GLM-OCR'a gönderiliyor...")

# "Text Recognition:" → GLM-OCR'nin resmi OCR promptu (dökümandan)
request_body = {
    "messages": [{
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{image_b64}"
                }
            },
            {
                "type": "text",
                "text": "Text Recognition:"   # GLM-OCR resmi promptu
            }
        ]
    }],
    "max_tokens": 1024,
    "temperature": 0.0    # 0 = sadece gördüğünü yaz, yorum yapma
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {GLM_TOKEN}"
}

try:
    response = requests.post(GLM_API_URL, headers=headers, json=request_body, timeout=60)

    if response.status_code == 200:
        result = response.json()["choices"][0]["message"]["content"]
        print("\n" + "=" * 50)
        print("GLM-OCR ÇIKTISI:")
        print("=" * 50)
        print(result)
        print("=" * 50)
        print(f"\nToplam {len(result)} karakter çıkarıldı.")

        # Sonucu dosyaya kaydet
        with open("results/image_ocr_output.txt", "w", encoding="utf-8") as f:
            f.write(result)
        print("Kaydedildi: results/image_ocr_output.txt")

    else:
        print(f"HATA: HTTP {response.status_code}")
        print(response.text[:500])

except requests.exceptions.Timeout:
    print("HATA: Sunucu 60 saniyede yanıt vermedi.")
except Exception as e:
    print(f"HATA: {e}")
