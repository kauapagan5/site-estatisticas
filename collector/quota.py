"""Cliente HTTP da API-Sports com controle da cota diária.

- Conta as requisições do dia (UTC) em data/state/quota.json.
- Lê o cabeçalho x-ratelimit-requests-remaining e para antes de zerar.
- Espaça as requisições para respeitar o limite por minuto.
- Salva toda resposta bruta em data/raw/ antes de devolver.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

from . import config


class QuotaExceeded(Exception):
    """A cota do dia (ou do lote) acabou."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def load_key() -> str:
    key = os.environ.get("API_SPORTS_KEY", "").strip()
    env_file = config.ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("API_SPORTS_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        raise SystemExit("ERRO: defina API_SPORTS_KEY no ambiente ou em .env")
    return key


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data, compact: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    if compact:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(data, ensure_ascii=False, indent=1)
    tmp.write_text(text + "\n", encoding="utf-8")
    tmp.replace(path)


class ApiClient:
    """Cliente de uma API (football ou nba) com orçamento de requisições."""

    def __init__(self, api: str, base: str, min_interval: float = 0.0, budget: int | None = None):
        self.api = api
        self.base = base
        self.min_interval = min_interval
        self.key = load_key()
        self.state_path = config.STATE / "quota.json"
        self.session = requests.Session()
        self._last_call = 0.0
        self.used_this_run = 0
        # budget = máximo de requisições permitidas nesta execução
        self.budget = budget

    # --- estado da cota -------------------------------------------------
    def _state(self) -> dict:
        state = read_json(self.state_path, {}) or {}
        today = utc_now().date().isoformat()
        entry = state.get(self.api) or {}
        if entry.get("date") != today:
            entry = {"date": today, "used": 0, "remaining_header": None}
        state[self.api] = entry
        return state

    def used_today(self) -> int:
        return self._state()[self.api]["used"]

    def remaining_today(self) -> int:
        entry = self._state()[self.api]
        local = config.DAILY_LIMIT - entry["used"]
        header = entry.get("remaining_header")
        if header is not None:
            local = min(local, int(header))
        return max(0, local - config.RESERVE)

    def can_call(self) -> bool:
        if self.budget is not None and self.used_this_run >= self.budget:
            return False
        return self.remaining_today() > 0

    def _record(self, remaining_header: str | None) -> None:
        state = self._state()
        entry = state[self.api]
        entry["used"] += 1
        if remaining_header is not None and remaining_header.isdigit():
            entry["remaining_header"] = int(remaining_header)
        write_json(self.state_path, state, compact=False)

    # --- chamada --------------------------------------------------------
    def get(self, path: str, params: dict, raw_path: Path | None) -> dict:
        """Faz a requisição, salva o bruto em raw_path e devolve o JSON.

        Lança QuotaExceeded se não houver cota; RuntimeError em erro da API.
        """
        if not self.can_call():
            raise QuotaExceeded(f"{self.api}: cota da execução/dia esgotada")
        wait = self.min_interval - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        fetched_at = utc_now().isoformat(timespec="seconds")
        for attempt in range(3):
            try:
                r = self.session.get(
                    self.base + path,
                    params=params,
                    headers={"x-apisports-key": self.key},
                    timeout=40,
                )
                break
            except requests.RequestException:
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))
        self._last_call = time.monotonic()
        self.used_this_run += 1
        self._record(r.headers.get("x-ratelimit-requests-remaining"))
        r.raise_for_status()
        data = r.json()
        errors = data.get("errors")
        if isinstance(errors, dict) and "rateLimit" in errors and not getattr(self, "_retrying", False):
            # limite por minuto: espera e tenta uma vez de novo
            time.sleep(61)
            self._retrying = True
            try:
                return self.get(path, params, raw_path)
            finally:
                self._retrying = False
        if errors:
            # Erros de cota/limite: parar tudo
            text = json.dumps(errors, ensure_ascii=False)
            if "requests" in text.lower() or "limit" in text.lower():
                raise QuotaExceeded(f"{self.api}: {text}")
            raise RuntimeError(f"{self.api}{path} {params}: {text}")
        wrapped = {"_fetched_at": fetched_at, "_request": {"path": path, "params": params}, **data}
        if raw_path is not None:
            write_json(raw_path, wrapped)
        return wrapped
