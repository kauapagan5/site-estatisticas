import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatDetail, { StatDef } from "../components/StatDetail";
import { Back, Crest, FavButton, FilterBar, Loading, StatCard, jogos } from "../components/ui";
import { FootballPlayerFile, FootballPlayerGame, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
import { cell, ddmm, fixed, num } from "../lib/format";
import { per90, summarize } from "../lib/stats";
import { score } from "./FootballTeam";

const POS: Record<string, string> = { G: "Goleiro", D: "Defensor", M: "Meio-campista", F: "Atacante" };

const field = (k: keyof FootballPlayerGame) => (g: FootballPlayerGame) => (g.played ? (g[k] as number | null) : null);
const DEFS: StatDef<FootballPlayerGame>[] = [
  { key: "shots_on", label: "Chutes no gol", short: "chutes no gol", get: field("shots_on") },
  { key: "shots_total", label: "Chutes totais", short: "chutes", get: field("shots_total") },
  { key: "goals", label: "Gols", short: "gols", get: field("goals") },
  { key: "assists", label: "Assistências", short: "assistências", get: field("assists") },
  { key: "key_passes", label: "Passes-chave", short: "passes-chave", get: field("key_passes") },
  { key: "dribbles_success", label: "Dribles certos", short: "dribles", get: field("dribbles_success") },
  { key: "fouls_drawn", label: "Faltas sofridas", short: "faltas sofridas", get: field("fouls_drawn") },
  { key: "fouls_committed", label: "Faltas cometidas", short: "faltas cometidas", get: field("fouls_committed") },
  { key: "minutes", label: "Minutos", short: "minutos", get: field("minutes") },
];

export default function FootballPlayer() {
  const { id } = useParams();
  const state = useJson<FootballPlayerFile>(`football/player/${id}.json`);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [stat, setStat] = useState("shots_on");
  if (state.status !== "ok") return <Loading state={state} />;
  const { player, games } = state.data;
  const rows = applyFilters(games, filters);
  const played = rows.filter((g) => g.played);
  const mins = played.map((g) => g.minutes);
  const sOn = summarize(played.map((g) => g.shots_on));
  const sTot = summarize(played.map((g) => g.shots_total));
  const p90On = per90(played.map((g) => g.shots_on), mins);
  const p90Tot = per90(played.map((g) => g.shots_total), mins);
  const goals = summarize(played.map((g) => g.goals));
  const assists = summarize(played.map((g) => g.assists));
  const yellow = summarize(played.map((g) => g.yellow));
  const red = summarize(played.map((g) => g.red));
  const minAvg = summarize(mins);
  const leagues = [...new Set(games.map((g) => g.league_id))].map((l) => [l, l === 39 ? "Premier" : l === 71 ? "Brasileirão" : String(l)] as [number, string]);

  return (
    <div className="page">
      <Back to={`/futebol/time/${player.team_id}`} label={player.team ?? "Time"} />
      <header className="head">
        <Crest src={player.photo} alt={player.name} size={56} />
        <div className="head-text">
          <h1>{player.name}</h1>
          <div className="muted">
            <Link to={`/futebol/time/${player.team_id}`}>{player.team}</Link>
            {player.position && ` · ${POS[player.position] ?? player.position}`}
          </div>
          <div className="muted">{played.length} {played.length === 1 ? "jogo" : "jogos"} · {num(minAvg.avg, 0)} min por jogo</div>
        </div>
        <FavButton fav={{ key: `fp-${player.id}`, name: player.name, sub: player.team ?? "", href: `/futebol/jogador/${player.id}` }} />
      </header>
      <FilterBar filters={filters} onChange={setFilters} role leagues={leagues} />

      <div className="cards">
        <StatCard label="Chutes no gol" value={num(sOn.avg, 2)} sub={<>por 90: {fixed(p90On.value, 2)} · em {jogos(sOn.n)}</>}
          warn={p90On.smallSample && played.length ? `amostra pequena (${num(p90On.minutes, 0)} min)` : undefined} />
        <StatCard label="Chutes totais" value={num(sTot.avg, 2)} sub={<>por 90: {fixed(p90Tot.value, 2)} · em {jogos(sTot.n)}</>} />
        <StatCard label="Gols / assistências" value={`${goals.sum} / ${assists.sum}`} sub={<>em {jogos(played.length)}</>} />
        <StatCard label="Cartões" value={`${yellow.sum} 🟨 ${red.sum} 🟥`} sub="total no período" />
      </div>

      <StatDetail rows={played} defs={DEFS} selected={stat} onSelect={setStat} rowKey={(g) => String(g.fixture_id)}
        pointLabel={(g) => ddmm(g.date)}
        pointDetail={(g) => `${ddmm(g.date)} ${g.home ? "x" : "@"} ${g.opp ?? "?"} (${score(g)}) · ${g.minutes} min`} />

      <section className="card table-wrap">
        <h2>Jogo a jogo</h2>
        <p className="muted small">Linhas em destaque: jogos com chute no gol.</p>
        <table className="wide">
          <thead>
            <tr><th>Data</th><th>Adversário</th><th>C/F</th><th className="num">Min</th><th>T/R</th>
              <th className="num">No gol</th><th className="num">Chutes</th><th className="num">G</th><th className="num">A</th>
              <th className="num">PC</th><th className="num">Drib</th><th className="num">FS</th><th className="num">FC</th><th className="num">Cart</th></tr>
          </thead>
          <tbody>
            {rows.map((g) => g.played ? (
              <tr key={g.fixture_id} className={(g.shots_on ?? 0) > 0 ? "hl" : ""}>
                <td>{ddmm(g.date)}</td>
                <td><Link to={`/futebol/jogo/${g.fixture_id}`}>{g.opp ?? "?"}</Link></td>
                <td>{g.home ? "C" : "F"}</td>
                <td className="num">{cell(g.minutes)}</td>
                <td>{g.starter ? "T" : "R"}</td>
                <td className="num strong">{cell(g.shots_on)}</td><td className="num">{cell(g.shots_total)}</td>
                <td className="num">{cell(g.goals)}</td><td className="num">{cell(g.assists)}</td>
                <td className="num">{cell(g.key_passes)}</td><td className="num">{cell(g.dribbles_success)}</td>
                <td className="num">{cell(g.fouls_drawn)}</td><td className="num">{cell(g.fouls_committed)}</td>
                <td className="num">{(g.yellow ? "🟨".repeat(g.yellow) : "") + (g.red ? "🟥" : "") || "–"}</td>
              </tr>
            ) : (
              <tr key={g.fixture_id} className="dnp">
                <td>{ddmm(g.date)}</td><td>{g.opp ?? "?"}</td><td>{g.home ? "C" : "F"}</td>
                <td colSpan={11} className="muted">não jogou</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">T/R = titular/reserva · PC = passes-chave · FS/FC = faltas sofridas/cometidas</p>
      </section>
    </div>
  );
}
