// Confronto: os dois times lado a lado com as médias recentes e o histórico do confronto direto.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Crest, Loading, Seg, jogos } from "../components/ui";
import { Fixture, FootballTeamFile, NbaGame, NbaTeamFile, useJson } from "../lib/data";
import { applyFilters, DEFAULT_FILTERS, Window } from "../lib/filters";
import { dateTime, ddmm, num } from "../lib/format";
import { summarize } from "../lib/stats";
import { teamDefs } from "./FootballTeam";

function SideBySide({ left, right, rows }: { left: string; right: string; rows: { label: string; a: number | null; b: number | null }[] }) {
  return (
    <table className="card versus">
      <thead><tr><th className="num">{left}</th><th></th><th className="num">{right}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className={"num" + ((r.a ?? -1) > (r.b ?? -1) ? " strong" : "")}>{num(r.a, 2)}</td>
            <td className="center small">{r.label}</td>
            <td className={"num" + ((r.b ?? -1) > (r.a ?? -1) ? " strong" : "")}>{num(r.b, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const windows: [Window, string][] = [["5", "Últ. 5"], ["10", "Últ. 10"], ["20", "Últ. 20"], ["season", "Temporada"]];

export function FootballMatch() {
  const { id } = useParams();
  const fixtures = useJson<Fixture[]>("football/fixtures.json");
  const fx = fixtures.status === "ok" ? fixtures.data.find((f) => f.id === Number(id)) : undefined;
  const home = useJson<FootballTeamFile>(fx ? `football/team/${fx.home_id}.json` : null);
  const away = useJson<FootballTeamFile>(fx ? `football/team/${fx.away_id}.json` : null);
  const [win, setWin] = useState<Window>("10");
  const [venue, setVenue] = useState<"all" | "split">("all");
  const [period, setPeriod] = useState<"FT" | "1T" | "2T">("FT");
  if (fixtures.status !== "ok") return <Loading state={fixtures} />;
  if (!fx) return <p className="pad">Jogo não encontrado.</p>;
  const ok = home.status === "ok" && away.status === "ok";
  const defs = teamDefs(period).filter((d) => !["possession", "offsides"].includes(d.key));
  const homeGames = ok ? applyFilters(home.data.games, { ...DEFAULT_FILTERS, window: win, venue: venue === "split" ? "home" : "all" }) : [];
  const awayGames = ok ? applyFilters(away.data.games, { ...DEFAULT_FILTERS, window: win, venue: venue === "split" ? "away" : "all" }) : [];
  const h2h = fixtures.data.filter((f) => f.id !== fx.id && f.gh !== null &&
    ((f.home_id === fx.home_id && f.away_id === fx.away_id) || (f.home_id === fx.away_id && f.away_id === fx.home_id)));
  const finished = fx.gh !== null && ["FT", "AET", "PEN"].includes(fx.status);
  return (
    <div className="page">
      <header className="match-head card">
        <Link to={`/futebol/time/${fx.home_id}`} className="side"><Crest src={fx.home_logo} alt={fx.home} size={40} /><span>{fx.home}</span></Link>
        <div className="center">
          <div className="big">{finished ? `${fx.gh} – ${fx.ga}` : "x"}</div>
          <div className="muted small">{dateTime(fx.date)}</div>
        </div>
        <Link to={`/futebol/time/${fx.away_id}`} className="side"><Crest src={fx.away_logo} alt={fx.away} size={40} /><span>{fx.away}</span></Link>
      </header>
      <div className="filters">
        <Seg<Window> label="Período" value={win} onChange={setWin} options={windows} />
        <Seg<"all" | "split"> label="Local" value={venue} onChange={setVenue} options={[["all", "Todos os jogos"], ["split", "Mandante em casa, visitante fora"]]} />
        <Seg label="Tempo" value={period} onChange={setPeriod} options={[["FT", "Jogo"], ["1T", "1º tempo"], ["2T", "2º tempo"]]} />
      </div>
      {!ok ? (home.status === "error" || away.status === "error"
        ? <p className="pad muted">Ainda não há jogos salvos de um dos times.</p> : <Loading state={{ status: "loading" }} />) : (
        <>
          <p className="muted small center">Médias em {homeGames.length} e {jogos(awayGames.length)}</p>
          <SideBySide left={fx.home} right={fx.away}
            rows={defs.map((d) => ({ label: d.label, a: summarize(homeGames.map(d.get)).avg, b: summarize(awayGames.map(d.get)).avg }))} />
        </>
      )}
      <section className="card">
        <h2>Confronto direto</h2>
        {h2h.length === 0 ? <p className="muted">Nenhum outro jogo entre os dois nos dados salvos.</p> : (
          <ul className="list">
            {h2h.map((f) => <li key={f.id}><Link to={`/futebol/jogo/${f.id}`}>{ddmm(f.date)} · {f.home} {f.gh}–{f.ga} {f.away}</Link></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

export function NbaMatch() {
  const { id } = useParams();
  const games = useJson<NbaGame[]>("nba/games.json");
  const g = games.status === "ok" ? games.data.find((x) => x.id === Number(id)) : undefined;
  const home = useJson<NbaTeamFile>(g ? `nba/team/${g.home_id}.json` : null);
  const away = useJson<NbaTeamFile>(g ? `nba/team/${g.away_id}.json` : null);
  const [win, setWin] = useState<Window>("10");
  if (games.status !== "ok") return <Loading state={games} />;
  if (!g) return <p className="pad">Jogo não encontrado.</p>;
  const ok = home.status === "ok" && away.status === "ok";
  const hg = ok ? applyFilters(home.data.games, { ...DEFAULT_FILTERS, window: win }) : [];
  const ag = ok ? applyFilters(away.data.games, { ...DEFAULT_FILTERS, window: win }) : [];
  const stats: [string, (x: NbaTeamFile["games"][number]) => number | null][] = [
    ["Pontos feitos", (x) => x.pts], ["Pontos sofridos", (x) => x.pts_against],
    ...[0, 1, 2, 3].map((i) => [`Pontos no ${i + 1}º quarto`, (x: NbaTeamFile["games"][number]) => x.quarters[i] ?? null] as [string, (x: NbaTeamFile["games"][number]) => number | null]),
    ["Bolas de 3", (x) => x.tpm], ["Rebotes", (x) => x.reb], ["Assistências", (x) => x.ast],
  ];
  return (
    <div className="page">
      <header className="match-head card">
        <Link to={`/nba/time/${g.away_id}`} className="side"><span>{g.away}</span></Link>
        <div className="center"><div className="big">{g.pts_away ?? "–"} @ {g.pts_home ?? "–"}</div><div className="muted small">{dateTime(g.date)}</div></div>
        <Link to={`/nba/time/${g.home_id}`} className="side"><span>{g.home}</span></Link>
      </header>
      <Seg<Window> label="Período" value={win} onChange={setWin} options={windows} />
      {ok ? (
        <SideBySide left={g.away} right={g.home}
          rows={stats.map(([label, fn]) => ({ label, a: summarize(ag.map(fn)).avg, b: summarize(hg.map(fn)).avg }))} />
      ) : <Loading state={{ status: "loading" }} />}
    </div>
  );
}
