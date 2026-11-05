import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Filters, Role, Venue, Window } from "../lib/filters";
import { LineHit } from "../lib/stats";
import { percent } from "../lib/format";
import { Favorite, useFavorites } from "../lib/storage";

export function Seg<T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className={v === value ? "on" : ""} aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ filters, onChange, role = false, leagues }: {
  filters: Filters; onChange: (f: Filters) => void; role?: boolean; leagues?: [number, string][];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="filters">
      <Seg<Window> label="Período" value={filters.window} onChange={(window) => set({ window })}
        options={[["5", "Últ. 5"], ["10", "Últ. 10"], ["20", "Últ. 20"], ["season", "Temporada"]]} />
      <Seg<Venue> label="Local" value={filters.venue} onChange={(venue) => set({ venue })}
        options={[["all", "Todos"], ["home", "Casa"], ["away", "Fora"]]} />
      {role && (
        <Seg<Role> label="Titular ou reserva" value={filters.role} onChange={(r) => set({ role: r })}
          options={[["all", "Todos"], ["starter", "Titular"], ["bench", "Reserva"]]} />
      )}
      {leagues && leagues.length > 1 && (
        <Seg<string> label="Competição" value={String(filters.league)}
          onChange={(v) => set({ league: v === "all" ? "all" : Number(v) })}
          options={[["all", "Todas"], ...leagues.map(([id, name]) => [String(id), name] as [string, string])]} />
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: ReactNode; warn?: string }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className={"stat-value" + (value === "sem dado" ? " muted" : "")}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {warn && <div className="stat-warn">⚠ {warn}</div>}
    </div>
  );
}

export function LineBox({ text, onText, hit, unit }: { text: string; onText: (t: string) => void; hit: LineHit | null; unit: string }) {
  return (
    <div className="card linebox">
      <label>
        <span>Linha ({unit})</span>
        <input inputMode="decimal" placeholder="ex.: 4,5" value={text} onChange={(e) => onText(e.target.value)} />
      </label>
      <div className="line-result" aria-live="polite">
        {hit && hit.n > 0 ? (
          <>
            <strong>{hit.over} de {hit.n}</strong> acima ({percent(hit.rate)})
            <span className="muted"> · {hit.under} abaixo{hit.push ? ` · ${hit.push} igual` : ""}</span>
          </>
        ) : hit ? <span className="muted">sem jogos com dado</span> : <span className="muted">Digite uma linha para ver a taxa de acerto</span>}
      </div>
    </div>
  );
}

export function Loading({ state }: { state: { status: string; error?: string } }) {
  if (state.status === "loading") return <p className="muted pad">Carregando…</p>;
  return <p className="pad">Não foi possível carregar os dados ({state.error}).</p>;
}

export function FavButton({ fav }: { fav: Favorite }) {
  const { has, toggle } = useFavorites();
  const on = has(fav.key);
  return (
    <button type="button" className={"fav" + (on ? " on" : "")} onClick={() => toggle(fav)} aria-pressed={on}
      title={on ? "Remover dos favoritos" : "Salvar nos favoritos"}>
      {on ? "★" : "☆"}<span className="sr">{on ? " Remover dos favoritos" : " Favoritar"}</span>
    </button>
  );
}

export function Crest({ src, alt, size = 28 }: { src: string | null | undefined; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="crest-ph" style={{ width: size, height: size }} aria-hidden>{alt.slice(0, 1)}</span>;
  return <img className="crest" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

export function Back({ to, label }: { to: string; label: string }) {
  return <Link className="back" to={to}>← {label}</Link>;
}

export const jogos = (n: number) => `${n} ${n === 1 ? "jogo" : "jogos"}`;
