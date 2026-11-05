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

## Site

Vite + React + TypeScript em `site/`, publicado no GitHub Pages. Os dados vêm de `site/public/data/`, gerados por `scripts/build_site_data.py` a partir de `data/` (não ficam no Git).

```bash
python scripts/build_site_data.py
cd site && npm install && npm run dev   # http://localhost:5173
npm test                                # cálculos: média, por 90, %, taxa de linha
```

## Automação (GitHub Actions)

- `Coleta diária` (`.github/workflows/daily.yml`): todo dia às 09:00 UTC (06:00 em Brasília) e manual. Salva os dados no repositório.
- `Carga inicial` (`.github/workflows/backfill.yml`): manual.
- `Publicar site` (`.github/workflows/pages.yml`): a cada mudança na `main` e depois de cada coleta. Precisa de Settings → Pages → Source: **GitHub Actions**.
- Travas em `collector/config.py`: `COLLECTION_PAUSED` (nenhuma requisição) e `BACKFILL_ALLOWED` (carga inicial por id).
- Precisa do segredo `API_SPORTS_KEY` em Settings → Secrets and variables → Actions.
- Agendamentos só rodam a partir da branch `main`.

## Regras dos dados

- Estatística que a API não mandou = "sem dado" (null), nunca 0.
- Chute e passe-chave vazios de jogador que entrou em campo contam como 0. Quem não entrou = "não jogou", fora das médias.
- 2º tempo = bloco do 2º tempo da API; se faltar, jogo − 1º tempo.
