"""Etapa 3 — gera os JSON que o site lê, em site/public/data/.

Lê só data/normalized/ e data/raw/ (sem requisições). Gera:
  meta.json                 data da última atualização e fontes
  index.json                índice da busca (times e jogadores)
  football/fixtures.json    jogos conhecidos (passados e futuros)
  football/league/<id>.json ranking de médias da liga
  football/team/<id>.json   jogo a jogo do time (jogo, 1º e 2º tempo)
  football/player/<id>.json jogo a jogo do jogador
  nba/games.json, nba/league.json, nba/team/<id>.json, nba/player/<id>.json

Uso: python scripts/build_site_data.py
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from collector import config  # noqa: E402
from collector.normalize import search_name  # noqa: E402
from collector.quota import read_json  # noqa: E402

NORM = config.NORMALIZED
OUT = ROOT / "site" / "public" / "data"
MAX_BYTES = 200 * 1024
TEAM_FIELDS = ("goals", "goals_against", "corners", "corners_against", "shots_total", "shots_total_against",
               "shots_on", "shots_on_against", "yellow", "yellow_against", "red", "red_against")
FULL_ONLY = ("fouls", "offsides", "possession")
LEAGUE_FIELDS = ("goals", "goals_against", "corners", "corners_against", "shots_on", "shots_total", "yellow")

written: list[tuple[Path, int]] = []


def dump(rel: str, data) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    written.append((path, len(text.encode("utf-8"))))


def table(rel: str) -> list[dict]:
    return read_json(NORM / rel, []) or []


# ------------------------------------------------------------------ futebol

def build_football(index: list, fetched: list) -> None:
    fixtures = table("football/fixtures.json")
    tstats = table("football/team_match_stats.json")
    pstats = table("football/player_match_stats.json")
    teams = {t["id"]: t for t in table("football/teams.json")}
    players = {p["id"]: p for p in table("football/players.json")}
    fx_by_id = {f["id"]: f for f in fixtures}
    fetched += [f["fetched_at"] for f in fixtures if f.get("fetched_at")]

    # jogos conhecidos pelas listas por data (inclui os ainda não coletados e os futuros)
    known: dict[int, dict] = {}
    for path in sorted((config.RAW / "football" / "dates").glob("*.json")):
        data = read_json(path) or {}
        if data.get("_fetched_at"):
            fetched.append(data["_fetched_at"])
        for f in data.get("response") or []:
            known[f["fixture"]["id"]] = {
                "id": f["fixture"]["id"], "date": f["fixture"]["date"], "league_id": f["league"]["id"],
                "home_id": f["teams"]["home"]["id"], "home": f["teams"]["home"]["name"],
                "home_logo": f["teams"]["home"].get("logo"),
                "away_id": f["teams"]["away"]["id"], "away": f["teams"]["away"]["name"],
                "away_logo": f["teams"]["away"].get("logo"),
                "gh": f["goals"]["home"], "ga": f["goals"]["away"], "status": f["fixture"]["status"]["short"],
            }
            for side in ("home", "away"):
                t = f["teams"][side]
                teams.setdefault(t["id"], {"id": t["id"], "name": t["name"], "search": search_name(t["name"]),
                                           "logo": t.get("logo"), "league_id": f["league"]["id"]})
    for f in fixtures:
        known[f["id"]] = {
            "id": f["id"], "date": f["date"], "league_id": f["league_id"],
            "home_id": f["home_id"], "home": f["home"], "home_logo": teams.get(f["home_id"], {}).get("logo"),
            "away_id": f["away_id"], "away": f["away"], "away_logo": teams.get(f["away_id"], {}).get("logo"),
            "gh": f["goals_home"], "ga": f["goals_away"], "status": f["status"],
        }
    for k in known.values():
        k["collected"] = k["id"] in fx_by_id
    dump("football/fixtures.json", sorted(known.values(), key=lambda k: k["date"], reverse=True))

    # time: uma linha por jogo, com os três períodos
    team_games: dict[int, dict[int, dict]] = {}
    for r in tstats:
        f = fx_by_id[r["fixture_id"]]
        g = team_games.setdefault(r["team_id"], {}).setdefault(r["fixture_id"], {
            "fixture_id": r["fixture_id"], "date": r["date"], "league_id": r["league_id"], "home": r["home"],
            "opp_id": r["opponent_id"], "opp": teams.get(r["opponent_id"], {}).get("name"),
            "gf": f["goals_home"] if r["home"] else f["goals_away"],
            "ga": f["goals_away"] if r["home"] else f["goals_home"],
        })
        block = {k: r.get(k) for k in TEAM_FIELDS}
        if r["period"] == "FT":
            block.update({k: r.get(k) for k in FULL_ONLY})
        g[r["period"]] = block

    league_teams: dict[int, list] = {}
    for tid, games in team_games.items():
        t = teams[tid]
        rows = sorted(games.values(), key=lambda g: g["date"], reverse=True)
        league = config.FOOTBALL_LEAGUES.get(t["league_id"], {})
        dump(f"football/team/{tid}.json", {
            "team": {"id": tid, "name": t["name"], "logo": t.get("logo"), "league_id": t["league_id"],
                     "league": league.get("name")},
            "games": rows,
        })
        league_teams.setdefault(t["league_id"], []).append({
            "id": tid, "name": t["name"], "logo": t.get("logo"),
            "games": [{"date": g["date"], "home": g["home"],
                       **{p: {k: g.get(p, {}).get(k) for k in LEAGUE_FIELDS} for p in ("FT", "1T", "2T")}}
                      for g in rows[:38]],
        })

    for lid, info in config.FOOTBALL_LEAGUES.items():
        dump(f"football/league/{lid}.json", {
            "league": {"id": lid, "slug": info["slug"], "name": info["name"]},
            "teams": sorted(league_teams.get(lid, []), key=lambda t: t["name"]),
        })

    # jogador
    by_player: dict[int, list] = {}
    for r in pstats:
        f = fx_by_id[r["fixture_id"]]
        row = {k: v for k, v in r.items() if k not in ("player_id", "name", "season", "position", "opponent_id")}
        row["opp_id"] = r["opponent_id"]
        row["opp"] = teams.get(r["opponent_id"], {}).get("name")
        row["gf"] = f["goals_home"] if r["home"] else f["goals_away"]
        row["ga"] = f["goals_away"] if r["home"] else f["goals_home"]
        by_player.setdefault(r["player_id"], []).append(row)
    for pid, rows in by_player.items():
        p = players[pid]
        team = teams.get(p["team_id"], {})
        dump(f"football/player/{pid}.json", {
            "player": {"id": pid, "name": p["name"], "photo": p.get("photo"), "team_id": p["team_id"],
                       "team": team.get("name"), "team_logo": team.get("logo"), "position": p.get("position"),
                       "league_id": p.get("league_id")},
            "games": sorted(rows, key=lambda g: g["date"], reverse=True),
        })

    for tid, t in teams.items():
        if tid in team_games:
            index.append({"t": "team", "s": "football", "id": tid, "name": t["name"], "q": t["search"],
                          "sub": config.FOOTBALL_LEAGUES.get(t["league_id"], {}).get("name", ""),
                          "img": t.get("logo")})
    for pid in by_player:
        p = players[pid]
        index.append({"t": "player", "s": "football", "id": pid, "name": p["name"], "q": p["search"],
                      "sub": teams.get(p["team_id"], {}).get("name", ""), "img": p.get("photo")})


# ------------------------------------------------------------------ NBA

def build_nba(index: list, fetched: list) -> None:
    games = table("nba/nba_games.json")
    tgames = table("nba/nba_team_games.json")
    pgames = table("nba/nba_player_games.json")
    teams = {t["id"]: t for t in table("nba/teams.json")}
    players = {p["id"]: p for p in table("nba/players.json")}
    fetched += [g["fetched_at"] for g in games if g.get("fetched_at")]
    dump("nba/games.json", games)

    by_team: dict[int, list] = {}
    for r in tgames:
        row = {k: v for k, v in r.items() if k not in ("season", "team_id", "opponent_id")}
        row["opp_id"] = r["opponent_id"]
        row["opp"] = teams.get(r["opponent_id"], {}).get("name")
        by_team.setdefault(r["team_id"], []).append(row)
    league = []
    for tid, rows in by_team.items():
        t = teams[tid]
        rows.sort(key=lambda g: g["date"], reverse=True)
        dump(f"nba/team/{tid}.json", {"team": {"id": tid, "name": t["name"], "code": t.get("code"),
                                               "logo": t.get("logo")}, "games": rows})
        league.append({"id": tid, "name": t["name"], "logo": t.get("logo"),
                       "games": [{k: g[k] for k in ("date", "home", "pts", "pts_against", "tpm", "tpa", "reb", "ast")}
                                 for g in rows]})
        index.append({"t": "team", "s": "nba", "id": tid, "name": t["name"], "q": t["search"], "sub": "NBA",
                      "img": t.get("logo")})
    dump("nba/league.json", {"teams": sorted(league, key=lambda t: t["name"])})

    by_player: dict[int, list] = {}
    for r in pgames:
        g = next(x for x in games if x["id"] == r["game_id"])
        row = {k: v for k, v in r.items() if k not in ("player_id", "name", "season", "position", "opponent_id")}
        row["opp_id"] = r["opponent_id"]
        row["opp"] = teams.get(r["opponent_id"], {}).get("name")
        row["pts_team"] = g["pts_home"] if r["home"] else g["pts_away"]
        row["pts_opp"] = g["pts_away"] if r["home"] else g["pts_home"]
        by_player.setdefault(r["player_id"], []).append(row)
    for pid, rows in by_player.items():
        p = players[pid]
        team = teams.get(p["team_id"], {})
        dump(f"nba/player/{pid}.json", {
            "player": {"id": pid, "name": p["name"], "team_id": p["team_id"], "team": team.get("name"),
                       "team_logo": team.get("logo"), "position": p.get("position")},
            "games": sorted(rows, key=lambda g: g["date"], reverse=True),
        })
        index.append({"t": "player", "s": "nba", "id": pid, "name": p["name"], "q": p["search"],
                      "sub": team.get("name", ""), "img": None})


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)  # arquivos gerados: sempre refeitos a partir de data/
    index: list = []
    fetched: list[str] = []
    build_football(index, fetched)
    build_nba(index, fetched)
    dump("index.json", sorted(index, key=lambda i: i["name"]))
    dump("meta.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_data_update": max(fetched) if fetched else None,
        "sources": ["API-Football (api-sports.io)", "API-NBA (api-sports.io)"],
        "football_leagues": [{"id": lid, **info} for lid, info in config.FOOTBALL_LEAGUES.items()],
    })
    big = [(p, n) for p, n in written if n > MAX_BYTES]
    total = sum(n for _, n in written)
    print(f"{len(written)} arquivos em {OUT.relative_to(ROOT)} ({total / 1024:.0f} KB no total); "
          f"maior: {max(n for _, n in written) / 1024:.1f} KB")
    if big:
        for p, n in big:
            print(f"  ATENÇÃO: {p.relative_to(ROOT)} tem {n / 1024:.0f} KB (limite 200 KB)")
        sys.exit(1)


if __name__ == "__main__":
    main()
