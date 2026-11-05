"""Lógica da carga inicial do futebol, sem rede: qual id buscar em seguida."""

from collector import config, football


def make_known(ids, league=71, finished=True):
    known = {}
    for i, fid in enumerate(ids):
        known[fid] = {"league": league, "season": config.FOOTBALL_SEASON, "ts": 0,
                      "status": "FT" if finished else "NS", "home": i % 20, "away": (i + 1) % 20}
    return known


def test_busca_o_primeiro_id_desconhecido_abaixo_do_mais_recente(monkeypatch):
    known = make_known([1000, 999])
    monkeypatch.setattr(football, "is_collected_cached", lambda fid: True)
    st = {"other_ids": {}, "bottom": {}}
    assert football.next_backfill_id(71, known, st) == 998


def test_jogo_conhecido_mas_nao_coletado_vem_primeiro(monkeypatch):
    known = make_known([1000, 999])
    monkeypatch.setattr(football, "is_collected_cached", lambda fid: fid != 1000)
    st = {"other_ids": {}, "bottom": {}}
    assert football.next_backfill_id(71, known, st) == 1000


def test_pula_ids_de_outras_ligas_e_detecta_fim_do_bloco(monkeypatch):
    known = make_known([1000])
    monkeypatch.setattr(football, "is_collected_cached", lambda fid: True)
    others = {str(fid): 2 for fid in range(999, 999 - football.BLOCK_END_GAP, -1)}
    st = {"other_ids": others, "bottom": {}}
    assert football.next_backfill_id(71, known, st) is None
    assert st["bottom"]["71"] == 1000


def test_para_quando_todos_os_times_tem_jogos_suficientes(monkeypatch):
    monkeypatch.setattr(config, "BACKFILL_GAMES_PER_TEAM", 2)
    monkeypatch.setattr(football, "is_collected_cached", lambda fid: True)
    known = make_known(list(range(1000, 980, -1)))  # 20 jogos, cada time aparece 2 vezes
    st = {"other_ids": {}, "bottom": {}}
    assert football.next_backfill_id(71, known, st) is None


def test_sem_nenhum_id_conhecido_nao_faz_nada():
    assert football.next_backfill_id(39, {}, {"other_ids": {}, "bottom": {}}) is None
