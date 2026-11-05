"""Configurações compartilhadas do coletor."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
NORMALIZED = DATA / "normalized"
STATE = DATA / "state"

FOOTBALL_BASE = "https://v3.football.api-sports.io"
NBA_BASE = "https://v2.nba.api-sports.io"

# Ligas de futebol acompanhadas: id na API-Football -> informações
FOOTBALL_LEAGUES = {
    39: {"slug": "premier-league", "name": "Premier League", "teams": 20},
    71: {"slug": "brasileirao", "name": "Brasileirão Série A", "teams": 20},
}
FOOTBALL_SEASON = 2026

# Carga inicial: quantos jogos recentes por time
BACKFILL_GAMES_PER_TEAM = 20

# Cota (plano grátis: 100/dia por API, 10/min no futebol)
DAILY_LIMIT = 100
RESERVE = 5            # nunca gastar as últimas N requisições do dia
BACKFILL_MAX_PER_RUN = 80
FOOTBALL_MIN_INTERVAL = 6.5  # segundos entre requisições (10/min)

FINISHED = {"FT", "AET", "PEN"}
# Status que nunca terão estatísticas: não pedir de novo
TERMINAL_NO_STATS = {"CANC", "ABD", "AWD", "WO"}

# --- Travas decididas pelo usuário (05/11/2026) ---------------------------
# Conta da API-Sports suspensa; o suporte está analisando.
# Enquanto True, nenhum comando do coletor chama a API.
COLLECTION_PAUSED = True
# Carga inicial por id só depois de o suporte confirmar que é permitida no plano grátis.
BACKFILL_ALLOWED = False
