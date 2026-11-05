# Relatório da Etapa 0 — 05/11/2026 20:41 UTC

## API-Football
- Conta: plano **Free**, ativo: True, expira: 2027-11-05T00:00:00+00:00
- Cota hoje: 5 de 100 usadas

### Premier League (id 39)
- Nome na API: Premier League (England)
- Temporada atual: **2026** (2026-08-21 → 2027-05-30)
- Coverage: eventos sim, estatísticas de time sim, estatísticas de jogador sim, escalações sim
  ! football/fixtures {'league': 39, 'season': 2026, 'status': 'FT'} → erro da API: {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}
- Acesso à temporada 2026 pela lista da temporada: **NÃO** (ver erro acima)
- Nenhum jogo finalizado desta liga na janela de datas liberada (ontem/hoje)

### Brasileirão Série A (id 71)
- Nome na API: Serie A (Brazil)
- Temporada atual: **2026** (2026-01-28 → 2026-12-02)
- Coverage: eventos sim, estatísticas de time sim, estatísticas de jogador sim, escalações sim
  ! football/fixtures {'league': 71, 'season': 2026, 'status': 'FT'} → erro da API: {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}
- Acesso à temporada 2026 pela lista da temporada: **NÃO** (ver erro acima)
- Caminho alternativo (busca por data, ontem/hoje): **sim** — 5 jogos finalizados
- Jogo de teste: Botafogo 1 x 0 Atletico-MG (2026-11-05, id 1492441)
- /fixtures/statistics?half=true → blocos: statistics, statistics_1h, statistics_2h
  - Jogo inteiro (Botafogo): escanteios=4, chutes=13, no gol=3, faltas=17, impedimentos=0, posse=32%, amarelos=2
  - statistics_1h: escanteios=2, chutes=6, no gol=1, amarelos=1
  - statistics_2h: escanteios=2, chutes=7, no gol=2, amarelos=1
- Escanteios separados por tempo: **sim**
- /fixtures/players → 23 jogadores do Botafogo
  - Exemplo Gabriel Batista: min=90, reserva=False, chutes=None, no gol=0, gols=0, assist=0, passes-chave=None, dribles=0, faltas sofridas=1, cometidas=0
- Estatísticas de jogador por partida: **sim**

### Rayan no Bournemouth
- Bournemouth: id 35
- Encontrado: **Rayan** (id 407806, Midfielder, nº 37)

## API-NBA
- Base https://v2.nba.api-sports.io responde. Plano **Free**, cota hoje: 1 de 100
- Temporadas disponíveis: 2015 … 2026
  ! nba/games {'league': 'standard', 'season': 2026} → erro da API: {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}
- Acesso à temporada 2026 pela lista da temporada: **NÃO** (ver erro acima)
- Caminho alternativo (busca por data em UTC): sim — 14 jogos finalizados
- Jogo de teste: Miami Heat 117 @ LA Clippers 116 (2026-11-05, id 17061)
  - Placar por quarto (mandante): ['24', '43', '20', '20', '9']
- /players/statistics → 20 linhas de jogador
  - Maior pontuador Bam Adebayo: min=41, pts=35, reb=10, ast=4, 3P=1/3, FG=14/20, FT=6/8, stl=1, blk=0, tov=1
- /games/statistics → LA Clippers: pts=116, 3P=16/43, reb=47, ast=30
- Busca 'curry': Seth Curry (id 123), Stephen Curry (id 124)

Requisições gastas por este script: futebol 11, NBA 7.
