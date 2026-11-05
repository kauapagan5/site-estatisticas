import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crest } from "../components/ui";
import { Fixture, IndexItem, NbaGame, normalize, useJson } from "../lib/data";
import { dayBR, ddmm, hourMin, todayBR } from "../lib/format";
import { useFavorites } from "../lib/storage";

const LEAGUE: Record<number, string> = { 39: "Premier League", 71: "Brasileirão" };

function Search() {
  const index = useJson<IndexItem[]>("index.json");
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = normalize(q);
    if (term.length < 2 || index.status !== "ok") return [];
    const starts = index.data.filter((i) => i.q.startsWith(term) || i.q.split(" ").some((w) => w.startsWith(term)));
    const rest = index.data.filter((i) => !starts.includes(i) && i.q.includes(term));
    return [...starts, ...rest].slice(0, 12);
  }, [q, index]);
  const href = (i: IndexItem) => `/${i.s === "nba" ? "nba" : "futebol"}/${i.t === "team" ? "time" : "jogador"}/${i.id}`;
  return (
    <div className="search">
      <input type="search" placeholder="Buscar time ou jogador (ex.: curry, flamengo)" value={q} onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar time ou jogador" autoComplete="off" />
      {results.length > 0 && (
        <ul className="card results">
          {results.map((i) => (
            <li key={`${i.s}-${i.t}-${i.id}`}>
              <Link to={href(i)}>
                <Crest src={i.img} alt={i.name} size={26} />
                <span><strong>{i.name}</strong><span className="muted small"> · {i.t === "team" ? "Time" : "Jogador"} · {i.sub}{i.s === "nba" && i.t === "player" ? " (NBA)" : ""}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {normalize(q).length >= 2 && results.length === 0 && index.status === "ok" && <p className="muted small">Nada encontrado nos dados salvos.</p>}
    </div>
  );
}

function FootballDay() {
  const st = useJson<Fixture[]>("football/fixtures.json");
  if (st.status !== "ok") return null;
  const today = todayBR();
  const todays = st.data.filter((f) => dayBR(f.date) === today);
  const list = todays.length ? todays : st.data.filter((f) => f.gh !== null).slice(0, 6);
  return (
    <section>
      <h2>Futebol {todays.length ? "· jogos de hoje" : "· últimos jogos salvos"}</h2>
      <ul className="card games">
        {[...list].sort((a, b) => (a.date < b.date ? -1 : 1)).map((f) => (
          <li key={f.id}>
            <div className="g-meta muted small">{LEAGUE[f.league_id]} · {ddmm(f.date)} {hourMin(f.date)}</div>
            <div className="g-row">
              <span className="g-team"><Crest src={f.home_logo} alt={f.home} size={20} />{f.home}</span>
              <span className="g-score">{f.gh !== null && ["FT", "AET", "PEN"].includes(f.status) ? `${f.gh}–${f.ga}` : "x"}</span>
              <span className="g-team right">{f.away}<Crest src={f.away_logo} alt={f.away} size={20} /></span>
            </div>
            <Link className="btn" to={`/futebol/jogo/${f.id}`}>Comparar</Link>
          </li>
        ))}
        {list.length === 0 && <li className="muted">Nenhum jogo salvo.</li>}
      </ul>
    </section>
  );
}

function NbaDay() {
  const st = useJson<NbaGame[]>("nba/games.json");
  if (st.status !== "ok") return null;
  const today = todayBR();
  const todays = st.data.filter((g) => dayBR(g.date) === today);
  const list = todays.length ? todays : st.data.slice(0, 6);
  return (
    <section>
      <h2>NBA {todays.length ? "· jogos de hoje" : "· últimos jogos salvos"}</h2>
      <ul className="card games">
        {list.map((g) => (
          <li key={g.id}>
            <div className="g-meta muted small">{ddmm(g.date)} {hourMin(g.date)}</div>
            <div className="g-row">
              <span className="g-team">{g.away}</span>
              <span className="g-score">{g.pts_away ?? ""} @ {g.pts_home ?? ""}</span>
              <span className="g-team right">{g.home}</span>
            </div>
            <Link className="btn" to={`/nba/jogo/${g.id}`}>Comparar</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const { favs } = useFavorites();
  return (
    <div className="page">
      <Search />
      {favs.length > 0 && (
        <section>
          <h2>Favoritos</h2>
          <ul className="card list">
            {favs.map((f) => <li key={f.key}><Link to={f.href}><strong>{f.name}</strong> <span className="muted small">· {f.sub}</span></Link></li>)}
          </ul>
        </section>
      )}
      <FootballDay />
      <NbaDay />
    </div>
  );
}
