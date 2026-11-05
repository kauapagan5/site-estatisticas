"""Testes da normalização do futebol com um jogo real salvo (Flamengo 3x1 Grêmio, 04/11/2026)."""

import copy
import json
from pathlib import Path

from collector.normalize import normalize_fixture, search_name

DATA = Path(__file__).parent / "data"
FX = json.loads((DATA / "fixture_1492445.json").read_text())["response"][0]
HALF = json.loads((DATA / "stats_half_1492445.json").read_text())


def team_row(rows, team_id, period):
    return next(r for r in rows if r["team_id"] == team_id and r["period"] == period)


def test_placar_e_gols_por_tempo():
    fixture, teams, _ = normalize_fixture(FX, HALF, "x")
    assert (fixture["goals_home"], fixture["goals_away"], fixture["ht_home"], fixture["ht_away"]) == (3, 1, 3, 0)
    fla2 = team_row(teams, 127, "2T")
    assert fla2["goals"] == 0 and fla2["goals_against"] == 1


def test_escanteios_por_tempo_a_favor_e_contra():
    _, teams, _ = normalize_fixture(FX, HALF, "x")
    assert [team_row(teams, 127, p)["corners"] for p in ("FT", "1T", "2T")] == [7, 7, 0]
    assert [team_row(teams, 127, p)["corners_against"] for p in ("FT", "1T", "2T")] == [4, 1, 3]


def test_segundo_tempo_calculado_quando_falta_o_bloco():
    half = copy.deepcopy(HALF)
    for t in half["response"]:
        del t["statistics_2h"]
    _, teams, _ = normalize_fixture(FX, half, "x")
    gre2 = team_row(teams, 130, "2T")
    assert gre2["corners"] == 3          # 4 no jogo − 1 no 1º tempo
    assert gre2["shots_total"] == 3      # 7 − 4


def test_sem_estatistica_por_tempo_fica_sem_dado():
    _, teams, _ = normalize_fixture(FX, None, "x")
    assert team_row(teams, 127, "FT")["corners"] == 7  # vem do /fixtures?id
    assert not any(r["period"] == "1T" for r in teams if r["team_id"] == 127 and r["corners"] is not None)


def test_estatistica_ausente_fica_null_e_nao_zero():
    _, teams, _ = normalize_fixture(FX, HALF, "x")
    assert team_row(teams, 127, "FT")["offsides"] is None


def test_cartao_vermelho_vazio_vem_dos_eventos():
    _, teams, _ = normalize_fixture(FX, HALF, "x")
    assert team_row(teams, 127, "FT")["red"] == 0
    assert team_row(teams, 130, "FT")["yellow"] == 2


def test_chute_vazio_de_quem_jogou_vira_zero():
    _, _, players = normalize_fixture(FX, HALF, "x")
    rossi = next(p for p in players if p["player_id"] == 11756)
    assert rossi["played"] and rossi["minutes"] == 90
    assert rossi["shots_total"] == 0 and rossi["shots_on"] == 0
    assert rossi["key_passes"] is None  # outros campos vazios continuam "sem dado"


def test_quem_nao_jogou_fica_fora():
    _, _, players = normalize_fixture(FX, HALF, "x")
    bench = [p for p in players if not p["played"]]
    assert bench
    assert all(p["minutes"] is None and p["shots_total"] is None and p["starter"] is None for p in bench)


def test_titular_e_reserva():
    _, _, players = normalize_fixture(FX, HALF, "x")
    played = [p for p in players if p["played"]]
    assert sum(p["starter"] for p in played) == 22
    assert any(not p["starter"] for p in played)


def test_busca_sem_acento():
    assert search_name("Agustín Rossi") == "agustin rossi"
    assert search_name("Grêmio") == "gremio"
