"""Cliente da API: parada imediata em conta suspensa e travas do coletor (sem rede)."""

import pytest

from collector import config, football
from collector.quota import AccountSuspended, ApiClient

SUSPENDED = {"get": "fixtures", "errors": {"access": "Your account is suspended, check on https://dashboard.api-football.com."},
             "results": 0, "response": []}


class FakeResponse:
    status_code = 200
    headers = {"x-ratelimit-requests-remaining": "99"}

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload

    def raise_for_status(self):
        pass


class FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    def get(self, *a, **k):
        self.calls += 1
        return FakeResponse(self.payload)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("API_SPORTS_KEY", "teste")
    monkeypatch.setattr(config, "STATE", tmp_path)
    c = ApiClient("football", "https://exemplo.invalid")
    c.session = FakeSession(SUSPENDED)
    return c


def test_conta_suspensa_para_na_primeira_resposta(client):
    with pytest.raises(AccountSuspended):
        client.get("/fixtures", {"date": "2026-11-05"}, raw_path=None)
    assert client.session.calls == 1


def test_depois_da_suspensao_nao_tenta_de_novo(client):
    with pytest.raises(AccountSuspended):
        client.get("/fixtures", {"date": "2026-11-05"}, raw_path=None)
    with pytest.raises(AccountSuspended):
        client.get("/fixtures", {"date": "2026-11-04"}, raw_path=None)
    assert client.session.calls == 1


def test_robo_diario_sai_com_erro_na_suspensao(client, monkeypatch):
    monkeypatch.setattr(config, "COLLECTION_PAUSED", False)
    monkeypatch.setattr(football, "ApiClient", lambda *a, **k: client)
    monkeypatch.setattr(football, "save_state", lambda st: None)
    with pytest.raises(SystemExit) as exc:
        football.main(["daily"])
    assert exc.value.code == 2
    assert client.session.calls == 1


def test_coleta_pausada_nao_cria_cliente(monkeypatch):
    monkeypatch.setattr(config, "COLLECTION_PAUSED", True)
    monkeypatch.setattr(football, "ApiClient", lambda *a, **k: pytest.fail("não devia chamar a API"))
    football.main(["run"])


def test_carga_inicial_bloqueada(monkeypatch):
    monkeypatch.setattr(config, "COLLECTION_PAUSED", False)
    monkeypatch.setattr(config, "BACKFILL_ALLOWED", False)
    monkeypatch.setattr(football, "ApiClient", lambda *a, **k: pytest.fail("não devia chamar a API"))
    football.main(["backfill"])
