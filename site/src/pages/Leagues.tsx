import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Crest, FilterBar, Loading, Seg } from "../components/ui";
import { LeagueFile, Meta, NbaLeagueFile, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS, Filters } from "../lib/filters";
import { num } from "../lib/format";
import { summarize } from "../lib/stats";

type Period = "FT" | "1T" | "2T";
const FOOTBALL_STATS: [string, string][] = [
  ["corners", "Escanteios a favor"], ["corners_against", "Escanteios contra"], ["goals", "Gols marcados"],
  ["goals_against", "Gols sofridos"], ["shots_on", "Chutes no gol"], ["shots_total", "Chutes"], ["yellow", "Amarelos"],
];

function Ranking({ rows }: { rows: { id: number; name: string; logo: string | null; href: string; avg: number | null; n: number }[] }) {
  const sorted = [...rows].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  return (
    <ol className="card ranking">
      {sorted.map((r, i) => (
        <li key={r.id}>
          <span className="pos">{i + 1}</span>
          <Crest src={r.logo} alt={r.name} size={22} />
          <Link to={r.href}>{r.name}</Link>
          <span className="num strong">{num(r.avg, 2)}</span>
          <span className="muted small">{r.n} j</span>
        </li>
      ))}
      {sorted.length === 0 && <li className="muted">Ainda não há jogos salvos desta liga.</li>}
    </ol>
  );
}

export function FootballLeague() {
  const { liga } = useParams();
  const meta = useJson<Meta>("meta.json");
  const league = meta.status === "ok" ? meta.data.football_leagues.find((l) => l.slug === liga) : undefined;
  const state = useJson<LeagueFile>(league ? `football/league/${league.id}.json` : null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [period, setPeriod] = useState<Period>("1T");
  const [stat, setStat] = useState("corners");
  if (meta.status !== "ok") return <Loading state={meta} />;
  if (!league) return <p className="pad">Liga não encontrada.</p>;
  if (state.status !== "ok") return <Loading state={state} />;
  const rows = state.data.teams.map((t) => {
    const games = applyFilters(t.games, filters);
    const s = summarize(games.map((g) => (g[period]?.[stat as "corners"] ?? null) as number | null));
    return { id: t.id, name: t.name, logo: t.logo, href: `/futebol/time/${t.id}`, avg: s.avg, n: s.n };
  });
  return (
    <div className="page">
      <h1>{league.name}</h1>
      <p className="muted small">Classificação: sem dado (o plano grátis da API não libera a tabela da temporada atual).</p>
      <h2>Ranking de médias</h2>
      <FilterBar filters={filters} onChange={setFilters} />
      <Seg<Period> label="Tempo" value={period} onChange={setPeriod} options={[["FT", "Jogo"], ["1T", "1º tempo"], ["2T", "2º tempo"]]} />
      <label className="select">
        <span>Estatística</span>
        <select value={stat} onChange={(e) => setStat(e.target.value)}>
          {FOOTBALL_STATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <Ranking rows={rows} />
    </div>
  );
}

const NBA_STATS: [string, string][] = [["pts", "Pontos feitos"], ["pts_against", "Pontos sofridos"], ["tpm", "Bolas de 3"], ["reb", "Rebotes"], ["ast", "Assistências"]];

export function NbaLeague() {
  const state = useJson<NbaLeagueFile>("nba/league.json");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [stat, setStat] = useState("pts");
  if (state.status !== "ok") return <Loading state={state} />;
  const rows = state.data.teams.map((t) => {
    const s = summarize(applyFilters(t.games, filters).map((g) => g[stat as "pts"]));
    return { id: t.id, name: t.name, logo: t.logo, href: `/nba/time/${t.id}`, avg: s.avg, n: s.n };
  });
  return (
    <div className="page">
      <h1>NBA</h1>
      <p className="muted small">Classificação: sem dado (o plano grátis da API não libera a temporada atual).</p>
      <h2>Ranking de médias</h2>
      <FilterBar filters={filters} onChange={setFilters} />
      <label className="select">
        <span>Estatística</span>
        <select value={stat} onChange={(e) => setStat(e.target.value)}>
          {NBA_STATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <Ranking rows={rows} />
    </div>
  );
}
