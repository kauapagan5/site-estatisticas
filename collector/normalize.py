"""Transforma os brutos de data/raw/ nas tabelas de data/normalized/.

Não faz nenhuma requisição: pode ser rodado quantas vezes quiser.

Regras:
- Estatística que não veio da API fica null ("sem dado"), nunca 0.
- Exceção decidida pelo usuário: chutes (totais e no gol) e passes-chave de
  jogador que entrou em campo (minutos > 0) vazios contam como 0.
- Jogador sem minutos = "não jogou": todas as estatísticas ficam null.
- 2º tempo: usa o bloco statistics_2h; se faltar, 2º tempo = jogo − 1º tempo.
- Cartões do time: se a estatística vier vazia mas o jogo tiver eventos,
  conta os cartões nos eventos (1º tempo = minuto ≤ 45).

Uso: python -m collector.normalize
"""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

from . import config
from .quota import read_json

RAW = config.RAW / "football"
OUT = config.NORMALIZED / "football"
SOURCE = "API-Football (api-sports.io)"

# nome na API -> campo da tabela
TEAM_STATS = {
    "Corner Kicks": "corners",
    "Total Shots": "shots_total",
    "Shots on Goal": "shots_on",
    "Yellow Cards": "yellow",
    "Red Cards": "red",
    "Fouls": "fouls",
    "Offsides": "offsides",
    "Ball Possession": "possession",
}
FULL_ONLY = ("fouls", "offsides", "possession")  # tupla: ordem fixa nos arquivos
PERIODS = ("FT", "1T", "2T")


def search_name(name: str) -> str:
    """Nome sem acento e minúsculo, para a busca."""
    norm = unicodedata.normalize("NFKD", name or "")
    return "".join(c for c in norm if not unicodedata.combining(c)).lower().strip()


def to_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    text = str(value).strip().rstrip("%")
    try:
        num = float(text)
    except ValueError:
        return None
    return int(num) if num.is_integer() else num


def stat_block(items: list | None) -> dict:
    """Lista [{type, value}] da API -> {campo: valor}. Campos ausentes ficam null."""
    if items is None:
        return {}
    by_type = {i["type"]: i["value"] for i in items}
    return {field: to_number(by_type.get(api_name)) for api_name, field in TEAM_STATS.items()}


def sub(a, b):
    if a is None or b is None:
        return None
    return a - b


def cards_from_events(events: list, team_id: int) -> dict:
    """Cartões por período a partir dos eventos. Segundo amarelo conta como vermelho."""
    out = {p: {"yellow": 0, "red": 0} for p in PERIODS}
    for ev in events:
        if ev.get("type") != "Card" or (ev.get("team") or {}).get("id") != team_id:
            continue
        detail = (ev.get("detail") or "").lower()
        kind = "yellow" if detail == "yellow card" else "red" if detail in ("red card", "second yellow card") else None
        if kind is None:
            continue
        elapsed = (ev.get("time") or {}).get("elapsed") or 0
        period = "1T" if elapsed <= 45 else "2T"
        out["FT"][kind] += 1
        if elapsed <= 90:
            out[period][kind] += 1
    return out


def normalize_fixture(fx: dict, stats_half: dict | None, fetched_at: str) -> tuple[dict, list, list]:
    """Uma partida -> (linha de fixtures, linhas de team_match_stats, linhas de player_match_stats)."""
    f, lg, teams, score = fx["fixture"], fx["league"], fx["teams"], fx["score"]
    home, away = teams["home"], teams["away"]
    ht, ft = score.get("halftime") or {}, score.get("fulltime") or {}
    if ft.get("home") is None:
        ft = fx.get("goals") or {}
    fixture_row = {
        "id": f["id"],
        "league_id": lg["id"],
        "league": lg["name"],
        "season": lg["season"],
        "round": lg.get("round"),
        "date": f["date"],
        "timestamp": f["timestamp"],
        "status": f["status"]["short"],
        "home_id": home["id"],
        "home": home["name"],
        "away_id": away["id"],
        "away": away["name"],
        "goals_home": ft.get("home"),
        "goals_away": ft.get("away"),
        "ht_home": ht.get("home"),
        "ht_away": ht.get("away"),
        "venue": (f.get("venue") or {}).get("name"),
        "source": SOURCE,
        "fetched_at": fetched_at,
    }

    # ---- estatísticas de time por período
    per_team: dict[int, dict[str, dict]] = {}
    half_by_team = {t["team"]["id"]: t for t in ((stats_half or {}).get("response") or [])}
    full_by_team = {t["team"]["id"]: t for t in (fx.get("statistics") or [])}
    events = fx.get("events") or []
    for side, team in (("home", home), ("away", away)):
        tid = team["id"]
        h = half_by_team.get(tid) or {}
        full_items = h.get("statistics") if h.get("statistics") is not None else (full_by_team.get(tid) or {}).get("statistics")
        full = stat_block(full_items)
        first = stat_block(h.get("statistics_1h"))
        second = stat_block(h.get("statistics_2h"))
        if h.get("statistics_1h") is not None and h.get("statistics_2h") is None:
            second = {k: sub(full.get(k), first.get(k)) for k in full}
        blocks = {"FT": full, "1T": first, "2T": second}
        ev_cards = cards_from_events(events, tid) if events else None
        for period, block in blocks.items():
            if not block and period != "FT":
                continue
            for kind in ("yellow", "red"):
                if block.get(kind) is None and ev_cards is not None and (block or period == "FT"):
                    block[kind] = ev_cards[period][kind]
        goals_ft = ft.get(side)
        goals_1t = ht.get(side)
        goals = {"FT": goals_ft, "1T": goals_1t, "2T": sub(goals_ft, goals_1t)}
        per_team[tid] = {p: {**blocks[p], "goals": goals[p]} for p in PERIODS}

    team_rows = []
    for side, team, opp in (("home", home, away), ("away", away, home)):
        mine, theirs = per_team[team["id"]], per_team[opp["id"]]
        for period in PERIODS:
            m, t = mine[period], theirs[period]
            row = {
                "fixture_id": f["id"],
                "league_id": lg["id"],
                "season": lg["season"],
                "date": f["date"],
                "team_id": team["id"],
                "opponent_id": opp["id"],
                "home": side == "home",
                "period": period,
            }
            for field in ("goals", "corners", "shots_total", "shots_on", "yellow", "red"):
                row[field] = m.get(field)
                row[field + "_against"] = t.get(field)
            for field in FULL_ONLY:
                row[field] = m.get(field) if period == "FT" else None
            team_rows.append(row)

    # ---- jogadores
    player_rows = []
    for block in fx.get("players") or []:
        tid = block["team"]["id"]
        is_home = tid == home["id"]
        opp_id = away["id"] if is_home else home["id"]
        for p in block.get("players") or []:
            s = (p.get("statistics") or [{}])[0]
            games = s.get("games") or {}
            minutes = games.get("minutes")
            played = bool(minutes and minutes > 0)
            row = {
                "fixture_id": f["id"],
                "league_id": lg["id"],
                "season": lg["season"],
                "date": f["date"],
                "player_id": p["player"]["id"],
                "name": p["player"]["name"],
                "team_id": tid,
                "opponent_id": opp_id,
                "home": is_home,
                "played": played,
                "minutes": minutes if played else None,
                "starter": (not games.get("substitute")) if played else None,
                "position": games.get("position"),
            }
            shots = s.get("shots") or {}
            goals = s.get("goals") or {}
            passes = s.get("passes") or {}
            dribbles = s.get("dribbles") or {}
            fouls = s.get("fouls") or {}
            cards = s.get("cards") or {}
            values = {
                "shots_total": shots.get("total"),
                "shots_on": shots.get("on"),
                "goals": goals.get("total"),
                "assists": goals.get("assists"),
                "key_passes": passes.get("key"),
                "dribbles_success": dribbles.get("success"),
                "dribbles_attempts": dribbles.get("attempts"),
                "fouls_drawn": fouls.get("drawn"),
                "fouls_committed": fouls.get("committed"),
                "yellow": cards.get("yellow"),
                "red": cards.get("red"),
            }
            if played:
                # regra do usuário: chute e passe-chave vazios de quem jogou = 0
                for k in ("shots_total", "shots_on", "key_passes"):
                    if values[k] is None:
                        values[k] = 0
            else:
                values = {k: None for k in values}
            row.update(values)
            player_rows.append(row)
    return fixture_row, team_rows, player_rows


def write_table(path: Path, rows: list[dict]) -> None:
    """JSON com uma linha por registro (diffs pequenos no Git)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows]
    path.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")


def build_football() -> dict:
    fixtures, team_stats, player_stats = [], [], []
    teams: dict[int, dict] = {}
    players: dict[int, dict] = {}
    for path in sorted((RAW / "fixtures").glob("*.json")):
        data = read_json(path) or {}
        resp = data.get("response") or []
        if not resp:
            continue
        fx = resp[0]
        if fx["fixture"]["status"]["short"] not in config.FINISHED:
            continue
        stats_half = read_json(RAW / "stats_half" / path.name)
        frow, trows, prows = normalize_fixture(fx, stats_half, data.get("_fetched_at"))
        fixtures.append(frow)
        team_stats += trows
        player_stats += prows
        ts = fx["fixture"]["timestamp"]
        for side in ("home", "away"):
            t = fx["teams"][side]
            cur = teams.get(t["id"])
            if not cur or ts >= cur["_ts"]:
                teams[t["id"]] = {"id": t["id"], "name": t["name"], "search": search_name(t["name"]),
                                  "logo": t.get("logo"), "league_id": fx["league"]["id"], "_ts": ts}
        for block in fx.get("players") or []:
            for p in block.get("players") or []:
                pid = p["player"]["id"]
                cur = players.get(pid)
                if not cur or ts >= cur["_ts"]:
                    pos = ((p.get("statistics") or [{}])[0].get("games") or {}).get("position")
                    players[pid] = {"id": pid, "name": p["player"]["name"],
                                    "search": search_name(p["player"]["name"]),
                                    "photo": p["player"].get("photo"), "team_id": block["team"]["id"],
                                    "position": pos, "league_id": fx["league"]["id"], "_ts": ts}

    order = lambda r: (-(r.get("timestamp") or 0), r["id"])  # noqa: E731
    fixtures.sort(key=order)
    team_stats.sort(key=lambda r: (r["date"], r["fixture_id"], r["team_id"], PERIODS.index(r["period"])), reverse=False)
    player_stats.sort(key=lambda r: (r["date"], r["fixture_id"], r["player_id"]))
    for d in (teams, players):
        for v in d.values():
            v.pop("_ts", None)

    write_table(OUT / "fixtures.json", fixtures)
    write_table(OUT / "team_match_stats.json", team_stats)
    write_table(OUT / "player_match_stats.json", player_stats)
    write_table(OUT / "teams.json", sorted(teams.values(), key=lambda t: t["id"]))
    write_table(OUT / "players.json", sorted(players.values(), key=lambda p: p["id"]))
    return {"fixtures": len(fixtures), "team_match_stats": len(team_stats),
            "player_match_stats": len(player_stats), "teams": len(teams), "players": len(players)}


# ===================================================================== NBA

NBA_RAW = config.RAW / "nba"
NBA_OUT = config.NORMALIZED / "nba"
NBA_SOURCE = "API-NBA (api-sports.io)"
NBA_COUNTS = {"pts": "points", "reb": "totReb", "ast": "assists", "stl": "steals", "blk": "blocks",
              "tov": "turnovers", "fgm": "fgm", "fga": "fga", "tpm": "tpm", "tpa": "tpa", "ftm": "ftm", "fta": "fta"}


def nba_minutes(value) -> float | None:
    """'34:12' -> 34.2; '37' -> 37.0; vazio -> None."""
    if value is None or value == "" or value == "-":
        return None
    text = str(value).strip()
    try:
        if ":" in text:
            mins, secs = text.split(":", 1)
            return round(int(mins) + int(secs) / 60, 2)
        return float(text)
    except ValueError:
        return None


def build_nba() -> dict:
    games: dict[int, dict] = {}
    for path in sorted((NBA_RAW / "dates").glob("*.json")):
        data = read_json(path) or {}
        for g in data.get("response") or []:
            games[g["id"]] = {**g, "_fetched_at": data.get("_fetched_at")}

    game_rows, player_rows, team_rows = [], [], []
    teams: dict[int, dict] = {}
    players: dict[int, dict] = {}
    for gid, g in sorted(games.items()):
        box = read_json(NBA_RAW / "players_stats" / f"{gid}.json")
        if g["status"]["long"] != "Finished" or not box:
            continue
        home, vis = g["teams"]["home"], g["teams"]["visitors"]
        sh, sv = g["scores"]["home"], g["scores"]["visitors"]
        q = lambda ls: [to_number(x) for x in (ls or [])]  # noqa: E731
        game_rows.append({
            "id": gid, "season": g["season"], "date": g["date"]["start"],
            "home_id": home["id"], "home": home["name"], "away_id": vis["id"], "away": vis["name"],
            "pts_home": sh.get("points"), "pts_away": sv.get("points"),
            "quarters_home": q(sh.get("linescore")), "quarters_away": q(sv.get("linescore")),
            "source": NBA_SOURCE, "fetched_at": g.get("_fetched_at"),
        })
        for t in (home, vis):
            teams[t["id"]] = {"id": t["id"], "name": t["name"], "search": search_name(t["name"]),
                              "code": t.get("code"), "logo": t.get("logo")}

        # jogadores
        sums: dict[int, dict] = {}
        for r in box.get("response") or []:
            tid = r["team"]["id"]
            is_home = tid == home["id"]
            minutes = nba_minutes(r.get("min"))
            played = bool(minutes and minutes > 0)
            row = {"game_id": gid, "season": g["season"], "date": g["date"]["start"],
                   "player_id": r["player"]["id"],
                   "name": f"{r['player'].get('firstname') or ''} {r['player'].get('lastname') or ''}".strip(),
                   "team_id": tid, "opponent_id": vis["id"] if is_home else home["id"], "home": is_home,
                   "played": played, "minutes": minutes if played else None, "position": r.get("pos")}
            for field, api in NBA_COUNTS.items():
                row[field] = to_number(r.get(api)) if played else None
            player_rows.append(row)
            if played:
                acc = sums.setdefault(tid, {k: 0 for k in NBA_COUNTS})
                for field in NBA_COUNTS:
                    if row[field] is not None:
                        acc[field] += row[field]
            players[row["player_id"]] = {"id": row["player_id"], "name": row["name"],
                                         "search": search_name(row["name"]), "team_id": tid,
                                         "position": r.get("pos")}

        # times
        tstats = {t["team"]["id"]: (t.get("statistics") or [{}])[0]
                  for t in ((read_json(NBA_RAW / "games_stats" / f"{gid}.json") or {}).get("response") or [])}
        for t, opp, s_me, s_opp, is_home in ((home, vis, sh, sv, True), (vis, home, sv, sh, False)):
            st = tstats.get(t["id"])
            base = {k: to_number(st.get(NBA_COUNTS[k])) for k in ("tpm", "tpa", "reb", "ast")} if st \
                else {k: sums.get(t["id"], {}).get(k) for k in ("tpm", "tpa", "reb", "ast")}
            team_rows.append({
                "game_id": gid, "season": g["season"], "date": g["date"]["start"],
                "team_id": t["id"], "opponent_id": opp["id"], "home": is_home,
                "pts": s_me.get("points"), "pts_against": s_opp.get("points"),
                "quarters": q(s_me.get("linescore")), "quarters_against": q(s_opp.get("linescore")),
                **base,
                "team_stats_source": "estatística do jogo" if st else "soma do box score dos jogadores",
            })

    game_rows.sort(key=lambda r: r["date"], reverse=True)
    player_rows.sort(key=lambda r: (r["date"], r["game_id"], r["player_id"]))
    team_rows.sort(key=lambda r: (r["date"], r["game_id"], r["team_id"]))
    write_table(NBA_OUT / "nba_games.json", game_rows)
    write_table(NBA_OUT / "nba_player_games.json", player_rows)
    write_table(NBA_OUT / "nba_team_games.json", team_rows)
    write_table(NBA_OUT / "teams.json", sorted(teams.values(), key=lambda t: t["id"]))
    write_table(NBA_OUT / "players.json", sorted(players.values(), key=lambda p: p["id"]))
    return {"nba_games": len(game_rows), "nba_player_games": len(player_rows),
            "nba_team_games": len(team_rows), "teams": len(teams), "players": len(players)}


def main() -> None:
    counts = build_football()
    print("Futebol normalizado:", ", ".join(f"{k}={v}" for k, v in counts.items()))
    counts = build_nba()
    print("NBA normalizada:", ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
