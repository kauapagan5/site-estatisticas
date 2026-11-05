import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatDetail, { StatDef } from "../components/StatDetail";
import { Back, Crest, FavButton, FilterBar, Loading, Seg, StatCard, jogos } from "../components/ui";
import { FootballTeamFile, FootballTeamGame, TeamPeriod, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
import { cell, ddmm, num } from "../lib/format";
import { summarize } from "../lib/stats";

type Period = "FT" | "1T" | "2T";
const PERIOD_LABEL: Record<Period, string> = { FT: "Jogo", "1T": "1º tempo", "2T": "2º tempo" };

const FIELDS: [keyof TeamPeriod, string, string, boolean][] = [
  // campo, nome, nome curto, só jogo inteiro?
  ["corners", "Escanteios a favor", "escanteios", false],
  ["corners_against", "Escanteios contra", "escanteios", false],
  ["goals", "Gols marcados", "gols", false],
  ["goals_against", "Gols sofridos", "gols", false],
  ["shots_total", "Chutes a favor", "chutes", false],
  ["shots_total_against", "Chutes contra", "chutes", false],
  ["shots_on", "Chutes no gol a favor", "chutes no gol", false],
  ["shots_on_against", "Chutes no gol contra", "chutes no gol", false],
  ["yellow", "Cartões amarelos", "amarelos", false],
  ["yellow_against", "Amarelos do adversário", "amarelos", false],
  ["red", "Cartões vermelhos", "vermelhos", false],
  ["fouls", "Faltas cometidas", "faltas", true],
  ["offsides", "Impedimentos", "impedimentos", true],
  ["possession", "Posse de bola (%)", "% de posse", true],
];

export function teamDefs(period: Period): StatDef<FootballTeamGame>[] {
  return FIELDS.filter(([, , , full]) => period === "FT" || !full).map(([f, label, short]) => ({
    key: f, label, short, get: (g) => (g[period]?.[f] ?? null) as number | null,
  }));
}

export const score = (g: { gf: number | null; ga: number | null }) =>
  g.gf === null || g.ga === null ? "–" : `${g.gf}–${g.ga}`;

export default function FootballTeam() {
  const { id } = useParams();
  const state = useJson<FootballTeamFile>(`football/team/${id}.json`);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [period, setPeriod] = useState<Period>("FT");
  const [stat, setStat] = useState("corners");
  if (state.status !== "ok") return <Loading state={state} />;
  const { team, games } = state.data;
  const rows = applyFilters(games, filters);
  const defs = teamDefs(period);
  const def = defs.find((d) => d.key === stat) ?? defs[0];
  const avg = (key: string) => summarize(rows.map(defs.find((d) => d.key === key)!.get));
  const leagues = [...new Set(games.map((g) => g.league_id))].map((l) => [l, l === 39 ? "Premier" : l === 71 ? "Brasileirão" : String(l)] as [number, string]);

  return (
    <div className="page">
      <Back to={team.league_id === 39 ? "/futebol/premier-league" : "/futebol/brasileirao"} label={team.league ?? "Liga"} />
      <header className="head">
        <Crest src={team.logo} alt={team.name} size={48} />
        <div className="head-text">
          <h1>{team.name}</h1>
          <div className="muted">{team.league} · {rows.length} {rows.length === 1 ? "jogo" : "jogos"} no filtro</div>
        </div>
        <FavButton fav={{ key: `ft-${team.id}`, name: team.name, sub: team.league ?? "", href: `/futebol/time/${team.id}` }} />
      </header>
      <FilterBar filters={filters} onChange={setFilters} leagues={leagues} />
      <Seg<Period> label="Tempo" value={period} onChange={setPeriod}
        options={[["FT", "Jogo"], ["1T", "1º tempo"], ["2T", "2º tempo"]]} />

      <div className="cards">
        {(["corners", "corners_against", "goals", "goals_against", "shots_on", "shots_on_against"] as const).map((k) => {
          const s = avg(k);
          return <StatCard key={k} label={defs.find((d) => d.key === k)!.label} value={num(s.avg, 2)}
            sub={<>mín {num(s.min)} · máx {num(s.max)} · {jogos(s.n)}</>} />;
        })}
      </div>

      <StatDetail rows={rows} defs={defs} selected={def.key} onSelect={setStat} rowKey={(g) => String(g.fixture_id)}
        pointLabel={(g) => ddmm(g.date)}
        pointDetail={(g) => `${ddmm(g.date)} ${g.home ? "x" : "@"} ${g.opp ?? "?"} (${score(g)}) · ${PERIOD_LABEL[period]}`} />

      <section className="card table-wrap">
        <h2>Jogo a jogo · {def.label} ({PERIOD_LABEL[period]})</h2>
        <table>
          <thead><tr><th>Data</th><th>Adversário</th><th>C/F</th><th>Placar</th><th className="num">{def.short}</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.fixture_id}>
                <td>{ddmm(g.date)}</td>
                <td><Link to={`/futebol/time/${g.opp_id}`}>{g.opp ?? "?"}</Link></td>
                <td>{g.home ? "Casa" : "Fora"}</td>
                <td><Link to={`/futebol/jogo/${g.fixture_id}`}>{score(g)}</Link></td>
                <td className="num strong">{cell(def.get(g))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">Nenhum jogo com esse filtro.</p>}
      </section>

      <section className="card table-wrap">
        <h2>Todas as médias · {PERIOD_LABEL[period]}</h2>
        <table>
          <thead><tr><th>Estatística</th><th className="num">Média</th><th className="num">Mín</th><th className="num">Máx</th><th className="num">Jogos</th></tr></thead>
          <tbody>
            {defs.map((d) => {
              const s = summarize(rows.map(d.get));
              return (
                <tr key={d.key}>
                  <td>{d.label}</td><td className="num strong">{num(s.avg, 2)}</td>
                  <td className="num">{num(s.min)}</td><td className="num">{num(s.max)}</td><td className="num">{s.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
