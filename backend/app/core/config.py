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
