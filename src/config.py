"""Application configuration.

Configuration is deliberately separated from business logic: everything
environment-dependent (API key, model, timeouts, retry policy) is loaded into
the :class:`AppConfig` dataclass here, and the rest of the codebase only ever
receives plain constructor arguments. That keeps providers, processor and
reporting fully decoupled from the environment they run in.

Environment variables use the ``TRIAGEDESK_`` prefix for app-owned settings;
the pre-rename ``AI_INQUIRY_`` names are still honoured so existing
deployments and ``.env`` files keep working.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_INITIAL_DELAY = 1.0
DEFAULT_RETRY_MAX_DELAY = 10.0
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_DB_PATH = "data/triagedesk.db"

VALID_PROVIDERS = ("openai", "mock")

DOTENV_PATH = Path(".env")

#: Legacy prefixes kept for backwards compatibility (checked after the current one).
LEGACY_ENV_PREFIXES = ("AI_INQUIRY_",)


class ConfigError(ValueError):
    """Raised when configuration is missing or invalid."""


@dataclass(frozen=True)
class AppConfig:
    """Immutable snapshot of everything the pipeline needs from the environment."""

    provider: str
    model: str
    api_key: str | None
    base_url: str | None
    timeout_seconds: float
    max_retries: int
    retry_initial_delay: float
    retry_max_delay: float
    output_dir: Path
    db_path: Path
    price_input_per_mtok: float | None = None
    price_output_per_mtok: float | None = None


def load_dotenv(path: Path = DOTENV_PATH) -> None:
    """Populate ``os.environ`` from a local ``.env`` file (developer convenience).

    The file is optional, and real environment variables always take
    precedence over values found in the file. Only simple ``KEY=VALUE`` lines
    (with optional ``#`` comments) are supported.
    """
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    return value if value else None


def _app_env(name: str) -> str | None:
    """Read an app-owned setting, preferring the current prefix over legacy names.

    ``name`` is given without prefix (e.g. ``"DB_PATH"``): ``TRIAGEDESK_DB_PATH``
    wins, then the legacy ``AI_INQUIRY_DB_PATH``.
    """
    for prefix in ("TRIAGEDESK_", *LEGACY_ENV_PREFIXES):
        value = _env(f"{prefix}{name}")
        if value is not None:
            return value
    return None


def _first(*values: object) -> object:
    return next((value for value in values if value is not None), None)


def _float_env(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        raise ValueError(f"environment variable {name} must be a number, got {raw!r}") from None


def _float_env_opt(name: str) -> float | None:
    """Optional float env var; unset/empty means ``None`` (feature disabled)."""
    raw = _env(name)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        raise ValueError(f"environment variable {name} must be a number, got {raw!r}") from None


def _int_env(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f"environment variable {name} must be an integer, got {raw!r}") from None


def load_config(
    *,
    provider: str | None = None,
    model: str | None = None,
    output_dir: str | None = None,
    timeout_seconds: float | None = None,
    max_retries: int | None = None,
    db_path: str | None = None,
) -> AppConfig:
    """Build an :class:`AppConfig` from explicit arguments, env vars and defaults.

    Precedence: explicit argument > environment variable > default.
    """
    load_dotenv()
    resolved_provider = str(
        _first(provider, _app_env("PROVIDER"), _env("LLM_PROVIDER"), DEFAULT_PROVIDER)
    ).lower()
    if resolved_provider not in VALID_PROVIDERS:
        raise ConfigError(
            f"unknown provider {resolved_provider!r}; expected one of {list(VALID_PROVIDERS)}"
        )
    return AppConfig(
        provider=resolved_provider,
        model=str(_first(model, _env("OPENAI_MODEL"), DEFAULT_MODEL)),
        api_key=_env("OPENAI_API_KEY"),
        base_url=_env("OPENAI_BASE_URL"),
        timeout_seconds=float(_first(timeout_seconds, _float_env("LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))),
        max_retries=int(_first(max_retries, _int_env("LLM_MAX_RETRIES", DEFAULT_MAX_RETRIES))),
        retry_initial_delay=float(
            _first(_float_env("LLM_RETRY_INITIAL_DELAY", DEFAULT_RETRY_INITIAL_DELAY))
        ),
        retry_max_delay=float(_first(_float_env("LLM_RETRY_MAX_DELAY", DEFAULT_RETRY_MAX_DELAY))),
        output_dir=Path(str(_first(output_dir, _app_env("OUTPUT_DIR"), DEFAULT_OUTPUT_DIR))),
        db_path=Path(str(_first(db_path, _app_env("DB_PATH"), DEFAULT_DB_PATH))),
        price_input_per_mtok=_float_env_opt("LLM_PRICE_INPUT_PER_MTOK"),
        price_output_per_mtok=_float_env_opt("LLM_PRICE_OUTPUT_PER_MTOK"),
    )
