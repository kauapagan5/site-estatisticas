import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatDetail, { StatDef } from "../components/StatDetail";
import { Back, Crest, FavButton, FilterBar, Loading, StatCard, jogos } from "../components/ui";
import { NbaTeamFile, NbaTeamGame, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
import { cell, ddmm, num, percent } from "../lib/format";
import { pct, summarize } from "../lib/stats";

const q = (i: number, against = false) => (g: NbaTeamGame) => (against ? g.quarters_against : g.quarters)[i] ?? null;
const DEFS: StatDef<NbaTeamGame>[] = [
  { key: "pts", label: "Pontos feitos", short: "pontos", get: (g) => g.pts },
  { key: "pts_against", label: "Pontos sofridos", short: "pontos", get: (g) => g.pts_against },
  { key: "total", label: "Pontos no jogo (soma)", short: "pontos", get: (g) => (g.pts === null || g.pts_against === null ? null : g.pts + g.pts_against) },
  ...[0, 1, 2, 3].map((i) => ({ key: `q${i + 1}`, label: `Pontos no ${i + 1}º quarto`, short: "pontos", get: q(i) })),
  { key: "tpm", label: "Bolas de 3 acertadas", short: "bolas de 3", get: (g) => g.tpm },
  { key: "reb", label: "Rebotes", short: "rebotes", get: (g) => g.reb },
  { key: "ast", label: "Assistências", short: "assistências", get: (g) => g.ast },
];

export default function NbaTeam() {
  const { id } = useParams();
  const state = useJson<NbaTeamFile>(`nba/team/${id}.json`);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [stat, setStat] = useState("pts");
  if (state.status !== "ok") return <Loading state={state} />;
  const { team, games } = state.data;
  const rows = applyFilters(games, filters);
  const s = (fn: (g: NbaTeamGame) => number | null) => summarize(rows.map(fn));
  const three = pct(rows.map((g) => g.tpm), rows.map((g) => g.tpa));
  const fromBox = rows.some((g) => g.team_stats_source !== "estatística do jogo");

  return (
    <div className="page">
      <Back to="/nba" label="NBA" />
      <header className="head">
        <Crest src={team.logo} alt={team.name} size={48} />
        <div className="head-text"><h1>{team.name}</h1><div className="muted">NBA · {jogos(rows.length)} no filtro</div></div>
        <FavButton fav={{ key: `nt-${team.id}`, name: team.name, sub: "NBA", href: `/nba/time/${team.id}` }} />
      </header>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="cards">
        <StatCard label="Pontos feitos" value={num(s((g) => g.pts).avg, 1)} sub={<>em {jogos(s((g) => g.pts).n)}</>} />
        <StatCard label="Pontos sofridos" value={num(s((g) => g.pts_against).avg, 1)} />
        <StatCard label="Bolas de 3" value={three.n ? `${num(three.made / three.n)}/${num(three.attempted / three.n)}` : "sem dado"} sub={percent(three.pct)} />
        <StatCard label="Rebotes · assistências" value={`${num(s((g) => g.reb).avg)} · ${num(s((g) => g.ast).avg)}`} />
      </div>

      <section className="card table-wrap">
        <h2>Média por quarto</h2>
        <table>
          <thead><tr><th></th><th className="num">1º</th><th className="num">2º</th><th className="num">3º</th><th className="num">4º</th></tr></thead>
          <tbody>
            <tr><td>Feitos</td>{[0, 1, 2, 3].map((i) => <td key={i} className="num strong">{num(s(q(i)).avg)}</td>)}</tr>
            <tr><td>Sofridos</td>{[0, 1, 2, 3].map((i) => <td key={i} className="num">{num(s(q(i, true)).avg)}</td>)}</tr>
          </tbody>
        </table>
      </section>

      <StatDetail rows={rows} defs={DEFS} selected={stat} onSelect={setStat} rowKey={(g) => String(g.game_id)}
        pointLabel={(g) => ddmm(g.date)} pointDetail={(g) => `${ddmm(g.date)} ${g.home ? "x" : "@"} ${g.opp ?? "?"} (${g.pts}–${g.pts_against})`} />

      <section className="card table-wrap">
        <h2>Jogo a jogo</h2>
        <table className="wide">
          <thead><tr><th>Data</th><th>Adversário</th><th>C/F</th><th>Placar</th><th>Quartos</th><th className="num">3P</th><th className="num">REB</th><th className="num">AST</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.game_id}>
                <td>{ddmm(g.date)}</td>
                <td><Link to={`/nba/time/${g.opp_id}`}>{g.opp ?? "?"}</Link></td>
                <td>{g.home ? "C" : "F"}</td>
                <td><Link to={`/nba/jogo/${g.game_id}`}>{g.pts}–{g.pts_against}</Link></td>
                <td className="small">{g.quarters.map(cell).join(" · ")}</td>
                <td className="num">{g.tpm === null ? "–" : `${g.tpm}/${g.tpa}`}</td>
                <td className="num">{cell(g.reb)}</td><td className="num">{cell(g.ast)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fromBox && <p className="muted small">Em alguns jogos, 3P, rebotes e assistências do time são a soma do box score dos jogadores (a API não mandou a estatística do time).</p>}
      </section>
    </div>
  );
}
