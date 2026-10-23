from functools import lru_cache
from urllib.parse import urlsplit
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BULKHEAD_", env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://bulkhead:bulkhead@db/bulkhead"
    origin: str = "http://localhost:8080"
    dev_localhost: bool = False
    google_client_id: str = ""
    google_client_secret: str = ""
    google_client_secret_file: str = ""
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_sender: str = "Bulkhead <security@bulkhead.local>"
    adapter_enabled: bool = False
    dry_run: bool = True
    tick_seconds: int = 2

    @model_validator(mode="after")
    def validate_origin(self):
        if self.google_client_secret_file:
            from pathlib import Path
            self.google_client_secret = Path(self.google_client_secret_file).read_text().strip()
        origin = urlsplit(self.origin)
        if origin.path or origin.query or origin.fragment or origin.username:
            raise ValueError("BULKHEAD_ORIGIN must be an origin without a path")
        if origin.scheme != "https" and not (self.dev_localhost and origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1")):
            raise ValueError("HTTPS required; explicitly enable DEV_LOCALHOST for loopback development")
        return self

    @property
    def secure_cookie(self):
        return self.origin.startswith("https://")

    @property
    def callback(self):
        return self.origin + "/api/v1/auth/google/callback"


@lru_cache
def settings():
    return Settings()
