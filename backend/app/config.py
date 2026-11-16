"""Configuración privada desde backend/.env y variables de entorno."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
DEFAULT_CORS_ORIGINS = ("http://localhost:4200", "http://127.0.0.1:4200")


def load_allowed_origins() -> list[str]:
    values = {**dotenv_values(ENV_FILE, encoding="utf-8-sig", interpolate=False), **os.environ}
    configured = values.get("CORS_ALLOWED_ORIGINS")
    if not isinstance(configured, str) or not configured.strip():
        return list(DEFAULT_CORS_ORIGINS)
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


class ConfigurationError(ValueError):
    """Error que contiene únicamente nombres de variables, nunca sus valores."""


@dataclass(frozen=True)
class DatabaseSettings:
    host: str
    port: int
    name: str = field(repr=False)
    user: str = field(repr=False)
    password: str = field(repr=False)
    connect_timeout: int = 5


def load_database_settings() -> DatabaseSettings:
    # No interpolar $ ni ${...} dentro de las contraseñas.
    values = {**dotenv_values(ENV_FILE, encoding="utf-8-sig", interpolate=False), **os.environ}
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_CONNECT_TIMEOUT")
    missing = [
        key for key in required
        if not (values.get(key) or "").strip()
        or (values.get(key) or "").startswith("CAMBIAR_")
    ]
    if missing:
        raise ConfigurationError("Completa en backend/.env: " + ", ".join(missing))

    def positive_integer(key: str, maximum: int) -> int:
        try:
            number = int(values[key])
        except (ValueError, TypeError):
            raise ConfigurationError(f"{key} debe ser un entero válido.") from None
        if not 1 <= number <= maximum:
            raise ConfigurationError(f"{key} debe estar entre 1 y {maximum}.")
        return number

    return DatabaseSettings(
        host=values["DB_HOST"],
        port=positive_integer("DB_PORT", 65535),
        name=values["DB_NAME"],
        user=values["DB_USER"],
        password=values["DB_PASSWORD"],
        connect_timeout=positive_integer("DB_CONNECT_TIMEOUT", 60),
    )


@dataclass(frozen=True)
class JWTSettings:
    secret_key: str = field(repr=False)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440


def load_jwt_settings() -> JWTSettings:
    values = {**dotenv_values(ENV_FILE, encoding="utf-8-sig", interpolate=False), **os.environ}
    secret_key = (values.get("JWT_SECRET_KEY") or "").strip()
    if not secret_key or secret_key.startswith("CAMBIAR_"):
        secret_key = "autos-colombia-dev-secret-key-change-in-prod-2026"
    algorithm = (values.get("JWT_ALGORITHM") or "").strip() or "HS256"
    try:
        expire_minutes = int(values.get("JWT_EXPIRE_MINUTES") or "1440")
    except (ValueError, TypeError):
        expire_minutes = 1440
    return JWTSettings(
        secret_key=secret_key,
        algorithm=algorithm,
        access_token_expire_minutes=expire_minutes,
    )
