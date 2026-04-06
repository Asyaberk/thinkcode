"""
config.py — Uygulama Ayarları (Environment Variables)

Tüm hassas bilgiler (DB şifresi, API anahtarları) kodun içine YAZILMAZ.
Bunun yerine .env dosyasından ya da Docker ortam değişkenlerinden okunur.
Pydantic BaseSettings sınıfı bu okuma işlemini otomatik yapar.

AYAR GRUPLARI:
  DB_*          → PostgreSQL bağlantı bilgileri (host, port, user, pass, db adı)
  JWT_*         → JSON Web Token şifrelemesi için gizli anahtar ve süre (24 saat)
  OPENAI_*      → ChatGPT / gpt-4.1-nano API anahtarı
  LANGFUSE_*    → AI gözlemlenebilirlik platformu (isteğe bağlı)
  GLM_OCR_*     → Mert'in GLM-OCR sunucusu (görüntü + taranmış PDF okuma)

database_url   → SQLAlchemy'nin anlayacağı PostgreSQL bağlantı URL'si
get_settings() → Singleton: ayarlar yalnızca bir kez yüklenir, sonra cache'den gelir
settings       → Proje genelinde import edilip kullanılan tekil nesne
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5433
    DB_USERNAME: str
    DB_PASSWORD: str
    DB_DATABASE: str

    JWT_SECRET_KEY: str = "thinkcode-super-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Open AI / Langfuse
    OPENAI_API_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # GLM-OCR — Mert'in sunucusu (görüntü tabanlı belgeler için)
    # Metin tabanlı PDF'lerde pdfplumber kullanılır, boş gelirse GLM-OCR devreye girer
    GLM_OCR_API_URL: str = "http://173.249.57.83:7003/v1/chat/completions"
    GLM_OCR_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USERNAME}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}"
        )

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
