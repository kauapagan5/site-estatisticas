# Especificação — Site de estatísticas de futebol e NBA

5 de nov. de 2026 · Kauã Pagan

> Documento de referência do projeto. Achados da Etapa 0 que mudam a especificação estão em `docs/etapa0.md`.

## Regras para o Claude Code

- Nunca invente dados. Todo número exibido vem da API e fica salvo no banco com a data e a partida de origem.
- Se uma estatística não vier da API para alguma liga, mostre "sem dado" e não use 0 no lugar.
- As chaves de API ficam só em GitHub Secrets ou em um `.env` fora do Git, nunca no código.
- Respeite os limites do plano grátis. Tudo que já foi baixado fica em cache e não é pedido de novo.
- Interface e textos em português do Brasil.

## Objetivo e escopo

Site gratuito de estatísticas para análise rápida de futebol e NBA, no estilo do Craque Stats: médias e histórico jogo a jogo de times e jogadores, com filtros.

Perguntas que o site precisa responder em poucos toques:

- Quantos escanteios o time X tem em média no 1º tempo nos últimos 10 jogos, em casa?
- Qual a média de chutes no gol do Rayan (Bournemouth) nos últimos jogos, quantos minutos ele jogou e em quais partidas chutou?
- Qual a média de bolas de 3 do Stephen Curry (acertadas x tentadas) nos últimos jogos?

Primeira versão: Premier League e Brasileirão Série A (temporada atual) e NBA (temporada atual). Fora do escopo: placar ao vivo, odds, login, app nativo.

## Funcionalidades

Filtros em todas as telas de time e jogador: últimos 5/10/20 jogos ou temporada; casa/fora/todos; competição. Jogadores: titular/reserva.

### Futebol — times

| Estatística | Recortes |
|---|---|
| Escanteios a favor e contra | Jogo, 1º tempo, 2º tempo |
| Gols marcados e sofridos | Jogo, 1º tempo, 2º tempo |
| Chutes totais e no gol (a favor e contra) | Jogo, 1º tempo, 2º tempo |
| Cartões amarelos e vermelhos | Jogo, 1º tempo, 2º tempo |
| Faltas, impedimentos, posse de bola | Jogo inteiro |

- Para cada estatística: média, mínimo, máximo e lista jogo a jogo (data, adversário, casa/fora, placar, valor).
- Taxa de acerto de linha: o usuário digita uma linha (ex.: 4,5) e o site mostra em quantos dos últimos N jogos ficou acima/abaixo ("6 de 10").

### Futebol — jogadores

| Estatística | Como mostrar |
|---|---|
| Minutos em campo | Por jogo e média |
| Titular ou reserva | Por jogo |
| Chutes totais e no gol | Por jogo, média por jogo e por 90 min |
| Gols e assistências | Por jogo e total |
| Passes-chave, dribles, faltas sofridas e cometidas | Por jogo e média |
| Cartões | Por jogo e total |

- Tabela jogo a jogo com destaque nas partidas em que o jogador chutou ao gol.
- Gráfico de barras dos últimos jogos com a linha do usuário sobreposta.
- Jogos em que não entrou aparecem como "não jogou" e ficam fora das médias.

### NBA — jogadores

| Estatística | Como mostrar |
|---|---|
| Minutos | Por jogo e média |
| Pontos, rebotes, assistências | Por jogo e média |
| Bolas de 3 acertadas x tentadas | Por jogo ("4/11"), médias e % do período |
| Arremessos de quadra e lances livres | Por jogo, médias e % |
| Roubos, tocos, erros | Por jogo e média |
| PRA (pontos + rebotes + assistências) | Por jogo e média |

- % do período = total acertado ÷ total tentado (não a média das %).
- Mesma taxa de acerto de linha e mesmo gráfico do futebol.

### NBA — times

- Pontos feitos e sofridos, por jogo e por quarto, bolas de 3, rebotes e assistências.
- Lista jogo a jogo e filtro casa/fora.

### Outras telas

- Busca única por time ou jogador, tolerante a acento e maiúscula.
- Próximos jogos do dia, com botão "comparar".
- Favoritos salvos no navegador.
- Rodapé com data/hora da última atualização e a fonte.

## Fontes de dados (grátis)

| Fonte | Uso | Limite grátis | Observação |
|---|---|---|---|
| API-Football | Jogos, estatísticas de time por tempo, de jogador por partida | 100 req/dia, 10 req/min, zera 00:00 UTC | Header `x-apisports-key`. Base `https://v3.football.api-sports.io` |
| API-NBA (API-Sports) | Jogos e box score | 100 req/dia | Base `https://v2.nba.api-sports.io` (confirmado na Etapa 0) |
| nba_api (Python) | Reserva NBA | Sem chave | Pode ser bloqueado em servidores na nuvem |
| football-data.org | Reserva para calendário | 10 req/min | Sem escanteios nem jogadores no grátis |

Endpoints API-Football: `/fixtures`, `/fixtures/statistics?fixture=<id>&half=true`, `/fixtures/players?fixture=<id>`, `/status`.
Endpoints API-NBA: `/games`, `/players/statistics?game=<id>`, `/games/statistics?id=<id>`.

Orçamento: futebol 2 req/partida; NBA 1–2 req/jogo; carga inicial no máximo ~80/dia por API; histórico nunca baixado de novo.

## Arquitetura gratuita

Coletor em Python 3.12 + requests rodando no GitHub Actions; dados no próprio repositório; site estático (Vite + React + TypeScript + Recharts) no GitHub Pages. Agendamento diário às 09:00 UTC, mais execução manual para a carga inicial.

```
site-estatisticas/
├─ ESPECIFICACAO.md
├─ collector/ (football.py, nba.py, quota.py, normalize.py)
├─ scripts/ (check_apis.py, build_site_data.py)
├─ data/raw/          # respostas da API, nunca apagar
├─ data/normalized/
├─ site/ (Vite + React; public/data/ com o JSON do site)
├─ tests/
└─ .github/workflows/ (daily.yml, backfill.yml)
```

## Modelo de dados

| Tabela | Uma linha por | Campos principais |
|---|---|---|
| fixtures | partida de futebol | id, liga, temporada, data, mandante, visitante, placar, placar 1T, status |
| team_match_stats | time × partida × período | escanteios, chutes, no gol, gols, amarelos, vermelhos, faltas, impedimentos, posse, casa/fora |
| player_match_stats | jogador × partida | minutos, titular, chutes, no gol, gols, assistências, passes-chave, dribles, faltas sofridas/cometidas, cartões, adversário, casa/fora |
| nba_games | jogo NBA | id, data, mandante, visitante, placar por quarto |
| nba_player_games | jogador × jogo | min, pts, reb, ast, stl, blk, tov, fgm, fga, 3pm, 3pa, ftm, fta, adversário, casa/fora |
| nba_team_games | time × jogo | pontos por quarto, 3pm, 3pa, rebotes, assistências |
| teams, players | time / jogador | id, nome, nome sem acento, escudo/foto, liga |

## Regras de cálculo

- Média por jogo = soma ÷ jogos em que entrou (minutos > 0).
- Por 90 = soma ÷ minutos × 90; abaixo de 270 min, aviso "amostra pequena".
- % de acerto = total acertado ÷ total tentado.
- 2º tempo = jogo − 1º tempo, se a API não trouxer o 2º tempo.
- Taxa de linha = jogos acima ÷ jogos do período, "6 de 10 (60%)".
- Estatística ausente = null, fora da média, com "média em N jogos".
- Minutos "34:12" → decimal.
- Listas: jogo mais recente primeiro.

## Telas

Mobile first, uma coluna, tema escuro padrão (com claro), vírgula decimal e datas dd/mm.

| Tela | Endereço |
|---|---|
| Início | `/` |
| Liga | `/futebol/:liga`, `/nba` |
| Time | `/futebol/time/:id`, `/nba/time/:id` |
| Jogador | `/futebol/jogador/:id`, `/nba/jogador/:id` |
| Confronto | `/futebol/jogo/:id`, `/nba/jogo/:id` |

Página de jogador: cabeçalho → filtros → cartões de média → campo "linha" → gráfico de barras → tabela jogo a jogo.

## Etapas

| Etapa | Pronto quando |
|---|---|
| 0. Verificar APIs | Relatório mostrado ao usuário |
| 1. Coletor de futebol | Uma rodada da PL salva e reprocessada sem novas requisições |
| 2. Coletor da NBA | Últimos 10 jogos do Curry com 3PM/3PA corretos |
| 3. JSON do site | Arquivos em `site/public/data/` < 200 KB cada |
| 4. Site | As 3 perguntas respondidas no celular |
| 5. Automação | Rodou sozinha 2 dias seguidos |
| 6. Conferência | 5 jogos comparados com site público, diferenças no README |

Testes mínimos: média, por 90, % e taxa de linha com dados fixos.
