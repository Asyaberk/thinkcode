"""
test_glm.py - Mert'in GLM OCR sunucusunu test eder

NE YAPIYOR?
  1. PDF dosyasını açar
  2. Her sayfayı görüntüye (PNG) çevirir
  3. Her görüntüyü Mert'in sunucusuna gönderir: "Burada ne yazıyor?"
  4. Sunucunun döndürdüğü metni ekrana yazar ve dosyaya kaydeder

NEDEN BÖYLE?
  - Mert'in sunucusu görüntü kabul ediyor (PDF değil)
  - Bu yüzden önce PDF → PNG dönüşümü yapıyoruz
  - Sonra PNG'yi base64 formatına çeviriyoruz (bu sadece görüntüyü
    metin olarak ifade etmenin bir yolu, sunucuya kolayca göndermek için)

KULLANIM:
  python3 test_glm.py
"""

import base64
import json
import os
import requests
from pdf2image import convert_from_path
from io import BytesIO
from config import GLM_OCR_API_URL, GLM_OCR_TOKEN  # .env'den okunuyor

# ─── AYARLAR ───────────────────────────────────────────────────────────────────

# Mert'in sunucusu ve token — artık .env'den okunuyor (config.py)
GLM_API_URL    = GLM_OCR_API_URL
GLM_AUTH_TOKEN = GLM_OCR_TOKEN

# Hangi PDF'i test edeceğiz
PDF_PATH = "1.1-intro-preprocessor.pdf"

# Kaç sayfa test edeceğiz (tüm belgeyi değil, sadece ilk 2 sayfayı dene)
# Çünkü her sayfa = bir istek = biraz zaman alıyor
MAX_PAGES = 2

# Sonuçları nereye kaydet
OUTPUT_FILE = "results/glm_output.txt"

# ─── YARDIMCI FONKSİYON: görüntüyü base64'e çevir ─────────────────────────────

def image_to_base64(pil_image):
    """
    PIL görüntüsünü base64 string'e çevirir.
    
    Base64 nedir?
    Görüntü dosyaları 0 ve 1'lerden oluşan binary veridir.
    Ama bir HTTP isteğinde binary veriyi düzgün göndermek zor.
    Base64, binary veriyi sadece harfler ve sayılardan oluşan
    bir metne çevirir - bu metin JSON içinde kolayca taşınabilir.
    """
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")   # görüntüyü PNG formatında belleğe yaz
    image_bytes = buffer.getvalue()        # byte'ları al
    base64_string = base64.b64encode(image_bytes).decode("utf-8")  # base64'e çevir
    return base64_string

# ─── ANA FONKSİYON: bir sayfayı GLM'e gönder ──────────────────────────────────

def ocr_page_with_glm(pil_image, page_number):
    """
    Tek bir sayfayı (PIL görüntüsü) GLM sunucusuna gönderir.
    Sunucudan dönen metni (OCR sonucunu) döndürür.
    
    pil_image: pdf2image'ın döndürdüğü görüntü nesnesi
    page_number: hangi sayfa olduğu (sadece log için)
    """
    print(f"  Sayfa {page_number} GLM'e gönderiliyor...")

    # Görüntüyü base64'e çevir
    img_base64 = image_to_base64(pil_image)

    # İstek gövdesi (body) - OpenAI API formatında
    # Mert'in sunucusu bu formatı anlıyor çünkü vLLM kullanıyor
    # vLLM = OpenAI API formatını taklit eden bir kütüphane
    request_body = {
        "messages": [
            {
                "role": "user",           # bu mesajı kullanıcı gönderiyor
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            # base64 görüntüyü bu formatta gönderiyoruz
                            # "data:image/png;base64," ön eki zorunlu
                            "url": f"data:image/png;base64,{img_base64}"
                        }
                    },
                    {
                        "type": "text",
                        # GLM-OCR'nin resmi promptu bu — dökümandan alındı
                        # "Text Recognition:" = sadece metni oku, yorum yapma
                        # "Formula Recognition:" = formül okuma için
                        # "Table Recognition:" = tablo için
                        "text": "Text Recognition:"
                    }
                ]
            }
        ],
        "max_tokens": 2048,    # maksimum kaç token dönsün
        "temperature": 0.0     # 0 = yaratıcılık yok, sadece gördüğünü yaz
    }

    # HTTP başlıkları (headers) - sunucuya kimliğimizi söylüyoruz
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GLM_AUTH_TOKEN}"
    }

    # İsteği gönder, yanıtı bekle
    try:
        response = requests.post(
            GLM_API_URL,
            headers=headers,
            json=request_body,
            timeout=60    # 60 saniye bekle, sonra hata ver
        )

        # HTTP 200 = başarılı, diğerleri = hata
        if response.status_code != 200:
            print(f"  HATA: Sunucu {response.status_code} döndürdü")
            print(f"  Detay: {response.text[:300]}")
            return None

        # Yanıtı JSON olarak parse et
        response_json = response.json()

        # Yanıtın içinden metni çıkar
        # OpenAI formatında yanıt: choices[0].message.content
        extracted_text = response_json["choices"][0]["message"]["content"]
        print(f"  ✓ Sayfa {page_number} tamamlandı ({len(extracted_text)} karakter)")
        return extracted_text

    except requests.exceptions.Timeout:
        print(f"  HATA: Sunucu 60 saniyede yanıt vermedi")
        return None
    except Exception as e:
        print(f"  HATA: {e}")
        return None

# ─── ANA PROGRAM ───────────────────────────────────────────────────────────────

def main():
    # Sonuçlar klasörünü oluştur (yoksa)
    os.makedirs("results", exist_ok=True)

    print("=" * 50)
    print("GLM OCR TESTİ")
    print("=" * 50)

    # 1. PDF'i yükle ve sayfalara böl
    print(f"\n1. PDF açılıyor: {PDF_PATH}")
    if not os.path.exists(PDF_PATH):
        print(f"HATA: {PDF_PATH} bulunamadı!")
        print("Bu scripti ocr-comparison klasöründen çalıştırdığından emin ol.")
        return

    # convert_from_path: PDF'in her sayfasını PIL görüntüsüne çevirir
    # dpi=72: çözünürlük - OCR için yeterli, sunucunun token limitini aşmıyor
    # Not: dpi yüksek olursa görüntü büyür, sunucunun 2048 token limiti aşılır
    pages = convert_from_path(PDF_PATH, dpi=72)
    print(f"   PDF açıldı: {len(pages)} sayfa bulundu")
    print(f"   Sadece ilk {MAX_PAGES} sayfa test edilecek\n")

    # 2. Her sayfayı GLM'e gönder
    print("2. Sayfalar GLM'e gönderiliyor...")
    all_text = []

    for i, page in enumerate(pages[:MAX_PAGES], start=1):
        text = ocr_page_with_glm(page, i)
        if text:
            all_text.append(f"--- SAYFA {i} ---\n{text}\n")

    # 3. Sonuçları birleştir ve kaydet
    print(f"\n3. Sonuçlar kaydediliyor: {OUTPUT_FILE}")
    combined_text = "\n".join(all_text)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(combined_text)

    # 4. Ekrana da göster
    print("\n" + "=" * 50)
    print("ÇIKARILAN METİN:")
    print("=" * 50)
    print(combined_text)
    print("=" * 50)
    print(f"\nTamamlandı! Sonuç '{OUTPUT_FILE}' dosyasına kaydedildi.")


# Python'da bu satır şu anlama geliyor:
# "Bu dosya doğrudan çalıştırılıyorsa main() fonksiyonunu başlat"
# (Başka bir dosya import ederse çalıştırma)
if __name__ == "__main__":
    main()
