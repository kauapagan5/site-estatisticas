"""Etapa 0 — verifica as APIs da API-Sports com a chave do usuário.

Uso:
    API_SPORTS_KEY=... python scripts/check_apis.py
    (ou um arquivo .env na raiz com API_SPORTS_KEY=...)

Gasta cerca de 13 requisições da API-Football e 7 da API-NBA (de 100/dia cada).
Gera um relatório em Markdown no terminal e em data/raw/_check/relatorio.md.
As respostas brutas ficam em data/raw/_check/ para consulta.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "raw" / "_check"

FOOTBALL_BASE = "https://v3.football.api-sports.io"
NBA_BASE = "https://v2.nba.api-sports.io"

LEAGUES = {"Premier League": 39, "Brasileirão Série A": 71}
BOURNEMOUTH_SEARCH = "Bournemouth"
RAYAN_SEARCH = "rayan"

MAX_REQUESTS = 30  # trava de segurança para não gastar cota à toa

report: list[str] = []
used = {"football": 0, "nba": 0}


def log(line: str = "") -> None:
    print(line)
    report.append(line)


def load_key() -> str:
    key = os.environ.get("API_SPORTS_KEY", "").strip()
    env_file = ROOT / ".env"
    if not key and env_file.exists():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            if raw.startswith("API_SPORTS_KEY="):
                key = raw.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("ERRO: defina API_SPORTS_KEY no ambiente ou em .env")
    return key


KEY = ""


def call(api: str, path: str, params: dict | None = None, tag: str = "") -> dict | None:
    """Faz uma requisição, salva o bruto e devolve o JSON (ou None em erro)."""
    if sum(used.values()) >= MAX_REQUESTS:
        log(f"  ! limite de segurança de {MAX_REQUESTS} requisições atingido, pulando {path}")
        return None
    base = FOOTBALL_BASE if api == "football" else NBA_BASE
    used[api] += 1
    try:
        r = requests.get(
            base + path,
            params=params or {},
            headers={"x-apisports-key": KEY},
            timeout=30,
        )
    except requests.RequestException as exc:
        log(f"  ! falha de rede em {api}{path}: {exc}")
        return None
    remaining = r.headers.get("x-ratelimit-requests-remaining")
    try:
        data = r.json()
    except ValueError:
        log(f"  ! {api}{path} respondeu HTTP {r.status_code} sem JSON")
        return None
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{api}_{tag or path.strip('/').replace('/', '_')}.json"
    (OUT_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    errors = data.get("errors")
    if errors:
        log(f"  ! {api}{path} {params or ''} → erro da API: {json.dumps(errors, ensure_ascii=False)}")
    if remaining is not None:
        data["_remaining"] = remaining
    return data


def ok(flag) -> str:
    if flag is None:
        return "sem dado"
    return "sim" if flag else "NÃO"


# ---------------------------------------------------------------- futebol

_by_date: dict[str, list] = {}


def recent_finished(league_id: int) -> list:
    """Plano grátis: só libera datas de ontem a amanhã. Busca ontem e hoje (todas as ligas, 1 req por dia)."""
    today = datetime.now(timezone.utc).date()
    out = []
    for d in (today - timedelta(days=1), today):
        key = d.isoformat()
        if key not in _by_date:
            data = call("football", "/fixtures", {"date": key}, tag=f"fixtures_date_{key}")
            _by_date[key] = (data or {}).get("response") or []
        out += [f for f in _by_date[key]
                if f["league"]["id"] == league_id and f["fixture"]["status"]["short"] in ("FT", "AET", "PEN")]
    return out

def check_football() -> None:
    log("## API-Football")
    st = call("football", "/status")
    if not st or not st.get("response"):
        log("  ! não foi possível ler /status — chave inválida ou sem acesso. Parando o futebol.")
        return
    resp = st["response"]
    sub = resp.get("subscription", {})
    req = resp.get("requests", {})
    log(f"- Conta: plano **{sub.get('plan')}**, ativo: {sub.get('active')}, expira: {sub.get('end')}")
    log(f"- Cota hoje: {req.get('current')} de {req.get('limit_day')} usadas")

    fixture_by_league: dict[str, int | None] = {}
    for name, lid in LEAGUES.items():
        log(f"\n### {name} (id {lid})")
        data = call("football", "/leagues", {"id": lid}, tag=f"leagues_{lid}")
        if not data or not data.get("response"):
            log("  ! liga não encontrada")
            continue
        item = data["response"][0]
        log(f"- Nome na API: {item['league']['name']} ({item['country']['name']})")
        seasons = item.get("seasons", [])
        current = next((s for s in seasons if s.get("current")), seasons[-1] if seasons else None)
        if not current:
            log("  ! nenhuma temporada listada")
            continue
        year = current["year"]
        cov = current.get("coverage", {})
        fx = cov.get("fixtures", {})
        log(f"- Temporada atual: **{year}** ({current.get('start')} → {current.get('end')})")
        log(f"- Coverage: eventos {ok(fx.get('events'))}, estatísticas de time {ok(fx.get('statistics_fixtures'))}, "
            f"estatísticas de jogador {ok(fx.get('statistics_players'))}, escalações {ok(fx.get('lineups'))}")

        games = call("football", "/fixtures", {"league": lid, "season": year, "status": "FT"},
                     tag=f"fixtures_{lid}_{year}")
        if not games or games.get("errors") or not games.get("response"):
            log(f"- Acesso à temporada {year} pela lista da temporada: **NÃO** (ver erro acima)")
            finished = recent_finished(lid)
            if not finished:
                log("- Nenhum jogo finalizado desta liga na janela de datas liberada (ontem/hoje)")
                fixture_by_league[name] = None
                continue
            log(f"- Caminho alternativo (busca por data, ontem/hoje): **sim** — {len(finished)} jogos finalizados")
        else:
            finished = games["response"]
            log(f"- Acesso à temporada {year} no plano grátis: **sim** — {len(finished)} jogos finalizados")
        last = max(finished, key=lambda f: f["fixture"]["timestamp"])
        fid = last["fixture"]["id"]
        fixture_by_league[name] = fid
        log(f"- Jogo de teste: {last['teams']['home']['name']} {last['goals']['home']} x "
            f"{last['goals']['away']} {last['teams']['away']['name']} "
            f"({last['fixture']['date'][:10]}, id {fid})")

        stats = call("football", "/fixtures/statistics", {"fixture": fid, "half": "true"},
                     tag=f"stats_{fid}")
        if stats and stats.get("response"):
            team0 = stats["response"][0]
            keys = [k for k in team0 if k not in ("team",)]
            full = {s["type"]: s["value"] for s in team0.get("statistics", [])}
            log(f"- /fixtures/statistics?half=true → blocos: {', '.join(keys)}")
            log(f"  - Jogo inteiro ({team0['team']['name']}): escanteios={full.get('Corner Kicks')}, "
                f"chutes={full.get('Total Shots')}, no gol={full.get('Shots on Goal')}, "
                f"faltas={full.get('Fouls')}, impedimentos={full.get('Offsides')}, posse={full.get('Ball Possession')}, "
                f"amarelos={full.get('Yellow Cards')}")
            halves = [k for k in keys if k != "statistics"]
            for h in halves:
                hs = {s["type"]: s["value"] for s in (team0.get(h) or [])}
                log(f"  - {h}: escanteios={hs.get('Corner Kicks')}, chutes={hs.get('Total Shots')}, "
                    f"no gol={hs.get('Shots on Goal')}, amarelos={hs.get('Yellow Cards')}")
            log(f"- Escanteios separados por tempo: **{ok(bool(halves))}**")
        else:
            log("- Escanteios separados por tempo: **NÃO** (sem resposta)")

        players = call("football", "/fixtures/players", {"fixture": fid}, tag=f"players_{fid}")
        if players and players.get("response"):
            team = players["response"][0]
            plist = team.get("players", [])
            sample = next((p for p in plist if (p["statistics"][0]["games"].get("minutes") or 0) > 0), None)
            log(f"- /fixtures/players → {len(plist)} jogadores do {team['team']['name']}")
            if sample:
                s = sample["statistics"][0]
                log(f"  - Exemplo {sample['player']['name']}: min={s['games'].get('minutes')}, "
                    f"reserva={s['games'].get('substitute')}, chutes={s['shots'].get('total')}, "
                    f"no gol={s['shots'].get('on')}, gols={s['goals'].get('total')}, "
                    f"assist={s['goals'].get('assists')}, passes-chave={s['passes'].get('key')}, "
                    f"dribles={s['dribbles'].get('success')}, faltas sofridas={s['fouls'].get('drawn')}, "
                    f"cometidas={s['fouls'].get('committed')}")
            log("- Estatísticas de jogador por partida: **sim**")
        else:
            log("- Estatísticas de jogador por partida: **NÃO**")

    # Rayan no Bournemouth
    log("\n### Rayan no Bournemouth")
    teams = call("football", "/teams", {"search": BOURNEMOUTH_SEARCH}, tag="teams_bournemouth")
    team_id = None
    if teams and teams.get("response"):
        team_id = teams["response"][0]["team"]["id"]
        log(f"- Bournemouth: id {team_id}")
    if team_id:
        squad = call("football", "/players/squads", {"team": team_id}, tag=f"squad_{team_id}")
        if squad and squad.get("response"):
            members = squad["response"][0].get("players", [])
            hits = [p for p in members if RAYAN_SEARCH in p["name"].lower()]
            if hits:
                for p in hits:
                    log(f"- Encontrado: **{p['name']}** (id {p['id']}, {p.get('position')}, nº {p.get('number')})")
            else:
                log(f"- Rayan **não** aparece no elenco ({len(members)} jogadores listados)")


# ---------------------------------------------------------------- NBA

def check_nba() -> None:
    log("\n## API-NBA")
    st = call("nba", "/status")
    if not st or not st.get("response"):
        log("  ! não foi possível ler /status da API-NBA (endereço ou chave). Parando a NBA.")
        return
    resp = st["response"]
    req = resp.get("requests", {})
    log(f"- Base {NBA_BASE} responde. Plano **{resp.get('subscription', {}).get('plan')}**, "
        f"cota hoje: {req.get('current')} de {req.get('limit_day')}")

    seasons = call("nba", "/seasons")
    season = None
    if seasons and seasons.get("response"):
        season = max(seasons["response"])
        log(f"- Temporadas disponíveis: {seasons['response'][0]} … {season}")

    games = call("nba", "/games", {"league": "standard", "season": season}, tag=f"games_{season}")
    if not games or games.get("errors") or not games.get("response"):
        log(f"- Acesso à temporada {season} pela lista da temporada: **NÃO** (ver erro acima)")
        today = datetime.now(timezone.utc).date()
        all_games = []
        for d in (today, today - timedelta(days=1)):
            data = call("nba", "/games", {"date": d.isoformat()}, tag=f"games_date_{d.isoformat()}")
            all_games += (data or {}).get("response") or []
            if any(g.get("status", {}).get("long") == "Finished" for g in all_games):
                break
        finished = [g for g in all_games if g.get("status", {}).get("long") == "Finished"]
        log(f"- Caminho alternativo (busca por data em UTC): {ok(bool(finished))} — {len(finished)} jogos finalizados")
    else:
        finished = [g for g in games["response"] if g.get("status", {}).get("long") == "Finished"]
        log(f"- Acesso à temporada {season}: **sim** — {len(games['response'])} jogos, {len(finished)} finalizados")
    if not finished:
        return
    last = max(finished, key=lambda g: g["date"]["start"])
    gid = last["id"]
    h, v = last["teams"]["home"], last["teams"]["visitors"]
    log(f"- Jogo de teste: {v['name']} {last['scores']['visitors']['points']} @ "
        f"{h['name']} {last['scores']['home']['points']} ({last['date']['start'][:10]}, id {gid})")
    log(f"  - Placar por quarto (mandante): {last['scores']['home'].get('linescore')}")

    ps = call("nba", "/players/statistics", {"game": gid}, tag=f"players_stats_{gid}")
    if ps and ps.get("response"):
        rows = ps["response"]
        r0 = max(rows, key=lambda r: r.get("points") or 0)
        log(f"- /players/statistics → {len(rows)} linhas de jogador")
        log(f"  - Maior pontuador {r0['player']['firstname']} {r0['player']['lastname']}: "
            f"min={r0.get('min')}, pts={r0.get('points')}, reb={r0.get('totReb')}, ast={r0.get('assists')}, "
            f"3P={r0.get('tpm')}/{r0.get('tpa')}, FG={r0.get('fgm')}/{r0.get('fga')}, "
            f"FT={r0.get('ftm')}/{r0.get('fta')}, stl={r0.get('steals')}, blk={r0.get('blocks')}, "
            f"tov={r0.get('turnovers')}")
    else:
        log("- /players/statistics: **sem dado**")

    gs = call("nba", "/games/statistics", {"id": gid}, tag=f"games_stats_{gid}")
    if gs and gs.get("response"):
        t = gs["response"][0]
        s = (t.get("statistics") or [{}])[0]
        log(f"- /games/statistics → {t['team']['name']}: pts={s.get('points')}, 3P={s.get('tpm')}/{s.get('tpa')}, "
            f"reb={s.get('totReb')}, ast={s.get('assists')}")
    else:
        log("- /games/statistics: **sem dado**")

    curry = call("nba", "/players", {"search": "curry"}, tag="players_curry")
    if curry and curry.get("response"):
        names = [f"{p['firstname']} {p['lastname']} (id {p['id']})" for p in curry["response"]]
        log(f"- Busca 'curry': {', '.join(names)}")


def main() -> None:
    global KEY
    KEY = load_key()
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    log(f"# Relatório da Etapa 0 — {now}\n")
    check_football()
    check_nba()
    log(f"\nRequisições gastas por este script: futebol {used['football']}, NBA {used['nba']}.")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "relatorio.md").write_text("\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
