"""Coletor da API-Football.

O plano grátis não lista a temporada atual, então:
- coleta diária: busca os jogos de ontem e de hoje pela data (1 req por data, todas as ligas);
- carga inicial: varre os ids dos jogos de cada liga, do mais recente para trás,
  até cada time ter BACKFILL_GAMES_PER_TEAM jogos salvos.

Cada partida finalizada custa 2 requisições:
  /fixtures?id=<id>                      (placar, eventos, estatísticas, jogadores)
  /fixtures/statistics?fixture=<id>&half=true   (estatísticas por tempo)
Tudo fica em data/raw/football/ e nunca é pedido de novo.

Uso:
  python -m collector.football daily
  python -m collector.football backfill [--max N]
  python -m collector.football run [--max N]        # daily + backfill
  python -m collector.football seed <time_a> <time_b>   # descobre ids via confronto direto
  python -m collector.football status
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config
from .quota import AccountSuspended, ApiClient, QuotaExceeded, read_json, utc_now, write_json

RAW = config.RAW / "football"
DATES = RAW / "dates"
FIXTURES = RAW / "fixtures"
STATS_HALF = RAW / "stats_half"
H2H = RAW / "h2h"
STATE_PATH = config.STATE / "football.json"

# ids consecutivos de outras ligas que indicam o fim do bloco de uma liga
BLOCK_END_GAP = 40


def log(msg: str) -> None:
    print(msg, flush=True)


# ------------------------------------------------------------------ estado

def load_state() -> dict:
    st = read_json(STATE_PATH, {}) or {}
    st.setdefault("other_ids", {})   # id -> liga (ou null se o id não existe)
    st.setdefault("bottom", {})      # liga -> menor id do bloco já confirmado
    return st


def save_state(st: dict) -> None:
    write_json(STATE_PATH, st, compact=False)


def fixture_path(fid: int) -> Path:
    return FIXTURES / f"{fid}.json"


def stats_path(fid: int) -> Path:
    return STATS_HALF / f"{fid}.json"


def load_fixture(fid: int) -> dict | None:
    data = read_json(fixture_path(fid))
    if not data or not data.get("response"):
        return None
    return data["response"][0]


def is_collected(fid: int) -> bool:
    fx = load_fixture(fid)
    if not fx:
        return False
    short = fx["fixture"]["status"]["short"]
    if short in config.TERMINAL_NO_STATS:
        return True
    return short in config.FINISHED and stats_path(fid).exists()


# ------------------------------------------------------------------ índice do que já se sabe

def known_fixtures() -> dict[int, dict]:
    """id -> {league, season, ts, status, home, away} a partir dos brutos salvos (sem requisições)."""
    out: dict[int, dict] = {}

    def add(fx: dict) -> None:
        out[fx["fixture"]["id"]] = {
            "league": fx["league"]["id"],
            "season": fx["league"]["season"],
            "ts": fx["fixture"]["timestamp"],
            "status": fx["fixture"]["status"]["short"],
            "home": fx["teams"]["home"]["id"],
            "away": fx["teams"]["away"]["id"],
        }

    for folder in (DATES, H2H):
        if folder.exists():
            for p in sorted(folder.glob("*.json")):
                for fx in (read_json(p) or {}).get("response") or []:
                    add(fx)
    if FIXTURES.exists():
        for p in FIXTURES.glob("*.json"):
            fx = (read_json(p) or {}).get("response") or []
            if fx:
                add(fx[0])  # o arquivo por id é o mais atual
    return out


# ------------------------------------------------------------------ requisições

def fetch_date(client: ApiClient, day: str) -> list[dict]:
    """Jogos de uma data (todas as ligas). Salva só as ligas acompanhadas."""
    data = client.get("/fixtures", {"date": day}, raw_path=None)
    tracked = [f for f in data.get("response") or [] if f["league"]["id"] in config.FOOTBALL_LEAGUES]
    data["response"] = tracked
    data["results"] = len(tracked)
    data["_filtrado_ligas"] = sorted(config.FOOTBALL_LEAGUES)
    write_json(DATES / f"{day}.json", data)
    return tracked


def fetch_fixture(client: ApiClient, fid: int, st: dict) -> dict | None:
    """Baixa /fixtures?id. Jogos de ligas não acompanhadas não ficam salvos (só anotados)."""
    data = client.get("/fixtures", {"id": fid}, raw_path=None)
    resp = data.get("response") or []
    if not resp:
        st["other_ids"][str(fid)] = None
        return None
    fx = resp[0]
    if fx["league"]["id"] not in config.FOOTBALL_LEAGUES:
        st["other_ids"][str(fid)] = fx["league"]["id"]
        return fx
    write_json(fixture_path(fid), data)
    return fx


def fetch_stats_half(client: ApiClient, fid: int) -> None:
    client.get("/fixtures/statistics", {"fixture": fid, "half": "true"}, raw_path=stats_path(fid))


def needs_refresh(fx: dict) -> bool:
    """Jogo salvo antes de terminar: pedir de novo se já deveria ter acabado."""
    short = fx["fixture"]["status"]["short"]
    if short in config.FINISHED or short in config.TERMINAL_NO_STATS:
        return False
    return fx["fixture"]["timestamp"] + 3 * 3600 < utc_now().timestamp()


def collect(client: ApiClient, fid: int, st: dict) -> str:
    """Garante fixture + estatísticas por tempo de um jogo. Devolve o que aconteceu."""
    fx = load_fixture(fid)
    if fx is None or needs_refresh(fx):
        fx = fetch_fixture(client, fid, st)
        if fx is None:
            return "inexistente"
        if fx["league"]["id"] not in config.FOOTBALL_LEAGUES:
            return f"outra liga ({fx['league']['name']})"
    short = fx["fixture"]["status"]["short"]
    if short not in config.FINISHED:
        return f"não finalizado ({short})"
    if not stats_path(fid).exists():
        fetch_stats_half(client, fid)
    return "ok"


def describe(fid: int) -> str:
    fx = load_fixture(fid)
    if not fx:
        return str(fid)
    t, g = fx["teams"], fx["goals"]
    return (f"{fid} {fx['fixture']['date'][:10]} {fx['league']['name']}: "
            f"{t['home']['name']} {g['home']} x {g['away']} {t['away']['name']}")


# ------------------------------------------------------------------ modos

def daily(client: ApiClient) -> None:
    """Jogos de ontem e de hoje (UTC)."""
    st = load_state()
    today = utc_now().date()
    try:
        for day in (today - timedelta(days=1), today):
            games = fetch_date(client, day.isoformat())
            log(f"[diário] {day}: {len(games)} jogos das ligas acompanhadas")
            for fx in games:
                fid = fx["fixture"]["id"]
                if fx["fixture"]["status"]["short"] not in config.FINISHED or is_collected(fid):
                    continue
                res = collect(client, fid, st)
                log(f"  {describe(fid)} → {res}")
    finally:
        save_state(st)


def team_counts_from(known: dict[int, dict], league: int, min_id: int) -> dict[int, int]:
    counts: dict[int, int] = {}
    for fid, k in known.items():
        if k["league"] != league or fid < min_id or not is_collected_cached(fid):
            continue
        if k["status"] not in config.FINISHED:
            continue
        for team in (k["home"], k["away"]):
            counts[team] = counts.get(team, 0) + 1
    return counts


_collected_cache: dict[int, bool] = {}


def is_collected_cached(fid: int) -> bool:
    if fid not in _collected_cache:
        _collected_cache[fid] = is_collected(fid)
    return _collected_cache[fid]


def next_backfill_id(league: int, known: dict[int, dict], st: dict) -> int | None:
    """Próximo id a buscar na liga, varrendo do jogo mais recente para trás."""
    season_ids = [fid for fid, k in known.items()
                  if k["league"] == league and k["season"] == config.FOOTBALL_SEASON
                  and k["status"] in config.FINISHED]
    if not season_ids:
        return None
    top = max(season_ids)
    bottom = st["bottom"].get(str(league))
    need = config.BACKFILL_GAMES_PER_TEAM
    n_teams = config.FOOTBALL_LEAGUES[league]["teams"]
    counts: dict[int, int] = {}
    gap = 0
    fid = top
    while True:
        if bottom is not None and fid < bottom:
            return None
        k = known.get(fid)
        other = st["other_ids"].get(str(fid), "desconhecido")
        if k and k["league"] == league:
            gap = 0
            if k["season"] != config.FOOTBALL_SEASON:
                return None  # chegou na temporada anterior
            if k["status"] in config.FINISHED and is_collected_cached(fid):
                for team in (k["home"], k["away"]):
                    counts[team] = counts.get(team, 0) + 1
            elif k["status"] in config.FINISHED or (
                    k["status"] not in config.TERMINAL_NO_STATS
                    and k["ts"] + 3 * 3600 < utc_now().timestamp()):
                return fid
        elif k or other != "desconhecido":
            gap += 1  # id de outra liga ou inexistente
        else:
            return fid  # id nunca visto: buscar
        if len(counts) >= n_teams and min(counts.values()) >= need:
            return None  # todos os times já têm jogos suficientes
        if gap >= BLOCK_END_GAP:
            st["bottom"][str(league)] = fid + gap
            return None
        fid -= 1


def backfill(client: ApiClient, max_requests: int) -> None:
    st = load_state()
    start = client.used_this_run
    active = list(config.FOOTBALL_LEAGUES)
    try:
        while active and client.used_this_run - start < max_requests:
            for league in list(active):
                known = known_fixtures()
                fid = next_backfill_id(league, known, st)
                if fid is None:
                    log(f"[carga] {config.FOOTBALL_LEAGUES[league]['name']}: nada a buscar")
                    active.remove(league)
                    continue
                res = collect(client, fid, st)
                _collected_cache.pop(fid, None)
                log(f"[carga] {describe(fid) if res == 'ok' else fid} → {res}")
                if client.used_this_run - start >= max_requests:
                    break
    except QuotaExceeded as exc:
        log(f"[carga] parando: {exc}")
    finally:
        save_state(st)


def seed(client: ApiClient, team_a: int, team_b: int) -> None:
    """Descobre ids de jogos pelo confronto direto (útil quando a liga ainda não tem nenhum id conhecido)."""
    data = client.get("/fixtures/headtohead", {"h2h": f"{team_a}-{team_b}"}, raw_path=None)
    data["response"] = [f for f in data.get("response") or [] if f["league"]["id"] in config.FOOTBALL_LEAGUES]
    write_json(H2H / f"{team_a}-{team_b}.json", data)
    for f in data["response"]:
        if f["league"]["season"] == config.FOOTBALL_SEASON:
            log(f"  {f['fixture']['id']} {f['fixture']['date'][:10]} {f['league']['name']} "
                f"{f['teams']['home']['name']} x {f['teams']['away']['name']} ({f['fixture']['status']['short']})")


def status() -> None:
    known = known_fixtures()
    for league, info in config.FOOTBALL_LEAGUES.items():
        ids = [fid for fid, k in known.items() if k["league"] == league and k["season"] == config.FOOTBALL_SEASON]
        done = [fid for fid in ids if is_collected(fid)]
        counts = team_counts_from(known, league, 0)
        low = min(counts.values()) if counts else 0
        log(f"{info['name']}: {len(done)} jogos completos de {len(ids)} conhecidos; "
            f"{len(counts)} times, o com menos jogos tem {low}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["daily", "backfill", "run", "seed", "status"])
    ap.add_argument("teams", nargs="*", type=int)
    ap.add_argument("--max", type=int, default=config.BACKFILL_MAX_PER_RUN,
                    help="máximo de requisições da carga inicial nesta execução")
    args = ap.parse_args(argv)

    if args.mode == "status":
        status()
        return
    if config.COLLECTION_PAUSED:
        log("Coleta pausada (config.COLLECTION_PAUSED): nenhuma requisição feita.")
        return
    if args.mode in ("backfill", "run", "seed") and not config.BACKFILL_ALLOWED:
        if args.mode != "run":
            log("Carga inicial bloqueada (config.BACKFILL_ALLOWED): nenhuma requisição feita.")
            return
        log("Carga inicial bloqueada (config.BACKFILL_ALLOWED): rodando só a coleta diária.")
    client = ApiClient("football", config.FOOTBALL_BASE, min_interval=config.FOOTBALL_MIN_INTERVAL)
    log(f"Cota do futebol hoje: {client.used_today()} usadas, {client.remaining_today()} disponíveis")
    try:
        if args.mode == "seed":
            if len(args.teams) != 2:
                sys.exit("uso: seed <time_a> <time_b>")
            seed(client, *args.teams)
        if args.mode in ("daily", "run"):
            daily(client)
        if args.mode in ("backfill", "run") and config.BACKFILL_ALLOWED:
            backfill(client, args.max)
    except AccountSuspended as exc:
        log(f"PARADO: {exc}. Nenhuma nova tentativa nesta execução.")
        sys.exit(2)
    except QuotaExceeded as exc:
        log(f"Parando: {exc}")
    log(f"Requisições nesta execução: {client.used_this_run}. "
        f"Cota do dia: {client.used_today()} usadas.")


if __name__ == "__main__":
    main()
