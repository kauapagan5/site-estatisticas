# Etapa 0 — Resultado da verificação das APIs (05/11/2026)

Script: `scripts/check_apis.py`. Saída completa em `docs/etapa0-relatorio-script.md`.

## O que funciona

| Item | Futebol (API-Football) | NBA (API-Sports) |
|---|---|---|
| Chave e conta | OK, plano Free, 100 req/dia | OK, plano Free, 100 req/dia |
| Endereço base | `v3.football.api-sports.io` | `v2.nba.api-sports.io` (confirmado) |
| Ids das ligas | Premier League = 39, Brasileirão = 71 | `league=standard` |
| Temporada atual | 2026 nas duas ligas | 2026 (= 2026-27) |
| Coverage | eventos, estatísticas de time e de jogador, escalações: sim nas duas ligas | — |
| Escanteios por tempo (`half=true`) | Sim: blocos `statistics`, `statistics_1h`, `statistics_2h` | — |
| Estatísticas de jogador por partida | Sim (minutos, reserva, chutes, gols, assistências, passes-chave, dribles, faltas, cartões) | Sim (min, pts, reb, ast, 3P, FG, FT, stl, blk, tov) |
| Rayan no Bournemouth | Sim: **Rayan**, id 407806, meia, nº 37 (Bournemouth id 35) | — |
| Stephen Curry | — | id 124 |

## O que o plano grátis bloqueia

| Pedido | Resposta |
|---|---|
| `/fixtures?league=..&season=2026` e `/games?season=2026` | "Free plans do not have access to this season, try from 2022 to 2024." |
| `/fixtures?date=` fora de ontem–amanhã | "try from 2026-11-04 to 2026-11-06" |
| `/fixtures?team=..&last=N` | "Free plans do not have access to the Last parameter." |
| `/fixtures?ids=a-b-c` (vários jogos numa requisição) | "Free plans do not have access to the Ids parameter." |

## Caminhos que passam pela restrição

- **Busca por data** de ontem até amanhã (futebol e NBA): serve para a coleta diária.
- **Busca por id** de qualquer jogo da temporada 2026, inclusive antigos (testado: Athletico-PR x Inter de 25/07/2026; Raptors x Timberwolves de 25/10/2026). Vale para `/fixtures?id=`, `/fixtures/statistics`, `/fixtures/players`, `/games?id=`, `/players/statistics?game=`.
- **Confronto direto** `/fixtures/headtohead?h2h=a-b` traz todos os jogos entre dois times, inclusive os de 2026, com os ids.
- Os ids da NBA são sequenciais (16980 = 25/10, 17048–17061 = jogos da madrugada de 05/11).

## Observações para as próximas etapas

- Jogos da NBA são datados em UTC: os jogos da noite de 04/11 nos EUA aparecem em `date=2026-11-05`.
- `/fixtures?id=` já traz estatísticas de time (sem divisão por tempo), eventos e jogadores numa só requisição. Por isso dá para usar `/fixtures?id=` + `/fixtures/statistics?half=true`, mantendo as 2 req/partida previstas.
- Em `/fixtures/players`, `shots.total` e `passes.key` às vezes vêm `null` quando `shots.on` vem 0 (ex.: goleiro). Precisa de decisão: pela regra da especificação, `null` = "sem dado".
