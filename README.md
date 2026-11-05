# site-estatisticas

Estatísticas de futebol (Premier League e Brasileirão) e NBA. Especificação completa em `ESPECIFICACAO.md`.

## Como os dados são coletados

O plano grátis da API-Sports não lista a temporada atual, mas libera:
- jogos por data, de ontem até amanhã → **coleta diária**;
- qualquer jogo pelo id → **carga inicial**, varrendo os ids do jogo mais recente para trás até cada time ter 20 jogos.

Cada partida de futebol custa 2 requisições (`/fixtures?id=` e `/fixtures/statistics?half=true`). Tudo que é baixado fica em `data/raw/` e nunca é pedido de novo. Detalhes em `docs/etapa0.md`.

## Rodar localmente

```bash
pip install -r requirements.txt
cp .env.example .env   # e coloque a chave (o .env não vai para o Git)
python -m collector.football run      # diário + carga inicial
python -m collector.football status   # quanto já foi coletado
python -m collector.normalize         # refaz as tabelas, sem requisições
python -m pytest -q tests
```

## Automação (GitHub Actions)

- `Coleta diária` (`.github/workflows/daily.yml`): todo dia às 09:00 UTC (06:00 em Brasília) e manual. Salva os dados no repositório.
- `Carga inicial` (`.github/workflows/backfill.yml`): manual.
- Precisa do segredo `API_SPORTS_KEY` em Settings → Secrets and variables → Actions.
- Agendamentos só rodam a partir da branch `main`.

## Regras dos dados

- Estatística que a API não mandou = "sem dado" (null), nunca 0.
- Chute vazio de jogador que entrou em campo conta como 0. Quem não entrou = "não jogou", fora das médias.
- 2º tempo = bloco do 2º tempo da API; se faltar, jogo − 1º tempo.
