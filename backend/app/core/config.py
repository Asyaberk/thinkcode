"""
config.py — Application Settings

All sensitive values (DB password, API keys) are read from environment
variables or a .env file — never hard-coded.
Pydantic BaseSettings handles validation and loading automatically.

Setting groups:
  DB_*          → PostgreSQL connection (host, port, user, password, db name)
  JWT_*         → JSON Web Token secret and expiry (default: 24 hours)
  OPENAI_*      → GPT API key
  LANGFUSE_*    → AI observability (optional)
  GLM_OCR_*     → Vision-language model endpoint for OCR-based PDF extraction
  MINIO_*       → Object storage for uploaded files

database_url   → SQLAlchemy-compatible PostgreSQL connection string
get_settings() → Cached singleton; settings are loaded once at startup
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DB_HOST:     str  = "127.0.0.1"
    DB_PORT:     int  = 5433
    DB_USERNAME: str  = ""
    DB_PASSWORD: str  = ""
    DB_DATABASE: str  = ""

    # Auth
    JWT_SECRET_KEY:    str = "thinkcode-super-secret-change-in-prod"
    JWT_ALGORITHM:     str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # OpenAI / Langfuse
    OPENAI_API_KEY:      str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_HOST:       str = "https://cloud.langfuse.com"

    # GLM-OCR (primary PDF extraction model — vision/OCR tasks only)
    GLM_OCR_API_URL: str = "http://173.249.57.83:7003/v1/chat/completions"
    GLM_OCR_TOKEN:   str = ""

    # VLLM — self-hosted LLM for routing simple AI Tutor responses
    # Uses the same server as GLM-OCR (port 7003) since it's OpenAI-compatible.
    # Set VLLM_ENABLED=false to disable routing and send everything to GPT.
    VLLM_BASE_URL:  str  = "http://173.249.57.83:7003/v1"
    VLLM_MODEL:     str  = "GLM-OCR-Q8_0.gguf"
    VLLM_TOKEN:     str  = ""          # will fall back to GLM_OCR_TOKEN if empty
    VLLM_ENABLED:   bool = True        # set False to disable routing entirely

    # MinIO object storage
    MINIO_ENDPOINT:    str  = "s3.iotiq.dev"
    MINIO_ACCESS_KEY:  str  = ""
    MINIO_SECRET_KEY:  str  = ""
    MINIO_BUCKET_NAME: str  = "thinkcode"
    MINIO_SECURE:      bool = True

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        """Build SQLAlchemy PostgreSQL connection URL."""
        return (
            f"postgresql+psycopg2://{self.DB_USERNAME}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}"
        )


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings singleton."""
    return Settings()


settings = get_settings()
