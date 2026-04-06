# ocr-comparison klasörü için ortak ayarlar
# Token ve URL artık burada — test dosyaları buradan import eder
# Gerçek projede settings'ten gelir ama bu klasör standalone

import os
from dotenv import load_dotenv

# Proje kökündeki .env dosyasını yükle
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GLM_OCR_API_URL = os.getenv("GLM_OCR_API_URL", "http://173.249.57.83:7003/v1/chat/completions")
GLM_OCR_TOKEN   = os.getenv("GLM_OCR_TOKEN", "")
