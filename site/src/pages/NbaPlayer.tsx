import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatDetail, { StatDef } from "../components/StatDetail";
import { Back, Crest, FavButton, FilterBar, Loading, StatCard, jogos } from "../components/ui";
import { NbaPlayerFile, NbaPlayerGame, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
import { cell, ddmm, fixed, num, percent } from "../lib/format";
import { pct, summarize, sumFields } from "../lib/stats";

const f = (k: keyof NbaPlayerGame) => (g: NbaPlayerGame) => (g.played ? (g[k] as number | null) : null);
const pra = (g: NbaPlayerGame) => (g.played ? sumFields(g as unknown as Record<string, unknown>, ["pts", "reb", "ast"]) : null);
const DEFS: StatDef<NbaPlayerGame>[] = [
  { key: "tpm", label: "Bolas de 3 acertadas", short: "bolas de 3", get: f("tpm") },
  { key: "tpa", label: "Bolas de 3 tentadas", short: "tentativas de 3", get: f("tpa") },
  { key: "pts", label: "Pontos", short: "pontos", get: f("pts") },
  { key: "reb", label: "Rebotes", short: "rebotes", get: f("reb") },
  { key: "ast", label: "Assistências", short: "assistências", get: f("ast") },
  { key: "pra", label: "PRA (pts + reb + ast)", short: "PRA", get: pra },
  { key: "fgm", label: "Arremessos de quadra certos", short: "arremessos", get: f("fgm") },
  { key: "ftm", label: "Lances livres certos", short: "lances livres", get: f("ftm") },
  { key: "stl", label: "Roubos", short: "roubos", get: f("stl") },
  { key: "blk", label: "Tocos", short: "tocos", get: f("blk") },
  { key: "tov", label: "Erros", short: "erros", get: f("tov") },
  { key: "minutes", label: "Minutos", short: "minutos", get: f("minutes") },
];

const made = (m: number | null, a: number | null) => (m === null || a === null ? "–" : `${m}/${a}`);

export default function NbaPlayer() {
  const { id } = useParams();
  const state = useJson<NbaPlayerFile>(`nba/player/${id}.json`);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [stat, setStat] = useState("tpm");
  if (state.status !== "ok") return <Loading state={state} />;
  const { player, games } = state.data;
  const rows = applyFilters(games, filters);
  const played = rows.filter((g) => g.played);
  const avg = (k: keyof NbaPlayerGame) => summarize(played.map((g) => g[k] as number | null));
  const three = pct(played.map((g) => g.tpm), played.map((g) => g.tpa));
  const fg = pct(played.map((g) => g.fgm), played.map((g) => g.fga));
  const ft = pct(played.map((g) => g.ftm), played.map((g) => g.fta));
  const praS = summarize(played.map(pra));
  const n = three.n;

  return (
    <div className="page">
      <Back to={`/nba/time/${player.team_id}`} label={player.team ?? "Time"} />
      <header className="head">
        <Crest src={player.team_logo} alt={player.name} size={48} />
        <div className="head-text">
          <h1>{player.name}</h1>
          <div className="muted"><Link to={`/nba/time/${player.team_id}`}>{player.team}</Link>{player.position && ` · ${player.position}`}</div>
          <div className="muted">{played.length} {played.length === 1 ? "jogo" : "jogos"} · {num(avg("minutes").avg, 1)} min por jogo</div>
        </div>
        <FavButton fav={{ key: `np-${player.id}`, name: player.name, sub: player.team ?? "NBA", href: `/nba/jogador/${player.id}` }} />
      </header>
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="cards">
        <StatCard label="Bolas de 3 (média)" value={n ? `${fixed(three.made / n)}/${fixed(three.attempted / n)}` : "sem dado"}
          sub={<>{percent(three.pct)} no período · {three.made}/{three.attempted} em {jogos(n)}</>} />
        <StatCard label="Pontos" value={num(avg("pts").avg, 1)} sub={<>mín {num(avg("pts").min)} · máx {num(avg("pts").max)}</>} />
        <StatCard label="PRA" value={num(praS.avg, 1)} sub={<>reb {num(avg("reb").avg, 1)} · ast {num(avg("ast").avg, 1)}</>} />
        <StatCard label="Arremessos / lances livres" value={`${percent(fg.pct)} / ${percent(ft.pct)}`}
          sub={<>FG {fg.made}/{fg.attempted} · LL {ft.made}/{ft.attempted}</>} />
        <StatCard label="Roubos · tocos · erros" value={`${num(avg("stl").avg)} · ${num(avg("blk").avg)} · ${num(avg("tov").avg)}`} sub="média por jogo" />
      </div>

      <StatDetail rows={played} defs={DEFS} selected={stat} onSelect={setStat} rowKey={(g) => String(g.game_id)}
        pointLabel={(g) => ddmm(g.date)}
        pointDetail={(g) => `${ddmm(g.date)} ${g.home ? "x" : "@"} ${g.opp ?? "?"} · 3P ${made(g.tpm, g.tpa)} · ${num(g.minutes, 0)} min`} />

      <section className="card table-wrap">
        <h2>Jogo a jogo</h2>
        <table className="wide">
          <thead>
            <tr><th>Data</th><th>Adversário</th><th>C/F</th><th className="num">Min</th><th className="num">PTS</th>
              <th className="num">REB</th><th className="num">AST</th><th className="num">3P</th><th className="num">FG</th>
              <th className="num">LL</th><th className="num">ROU</th><th className="num">TOC</th><th className="num">ERR</th><th className="num">PRA</th></tr>
          </thead>
          <tbody>
            {rows.map((g) => g.played ? (
              <tr key={g.game_id}>
                <td>{ddmm(g.date)}</td>
                <td><Link to={`/nba/jogo/${g.game_id}`}>{g.opp ?? "?"}</Link></td>
                <td>{g.home ? "C" : "F"}</td>
                <td className="num">{num(g.minutes, 0)}</td>
                <td className="num strong">{cell(g.pts)}</td><td className="num">{cell(g.reb)}</td><td className="num">{cell(g.ast)}</td>
                <td className="num strong">{made(g.tpm, g.tpa)}</td><td className="num">{made(g.fgm, g.fga)}</td>
                <td className="num">{made(g.ftm, g.fta)}</td><td className="num">{cell(g.stl)}</td><td className="num">{cell(g.blk)}</td>
                <td className="num">{cell(g.tov)}</td><td className="num">{cell(pra(g))}</td>
              </tr>
            ) : (
              <tr key={g.game_id} className="dnp"><td>{ddmm(g.date)}</td><td>{g.opp ?? "?"}</td><td>{g.home ? "C" : "F"}</td><td colSpan={11} className="muted">não jogou</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">3P, FG e LL = acertados/tentados · % do período = total acertado ÷ total tentado</p>
      </section>
    </div>
  );
}
