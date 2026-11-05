// Bloco "estatística escolhida": seletor, linha + taxa de acerto e gráfico dos jogos.
import { useState } from "react";
import { num, parseLine } from "../lib/format";
import { lineHit, summarize } from "../lib/stats";
import GamesChart, { ChartPoint } from "./GamesChart";
import { LineBox } from "./ui";

export interface StatDef<R> {
  key: string;
  label: string;
  short?: string;
  get: (row: R) => number | null;
}

export default function StatDetail<R>({ rows, defs, selected, onSelect, pointLabel, pointDetail, rowKey }: {
  rows: R[];                    // jogos filtrados, mais recente primeiro (só os que contam)
  defs: StatDef<R>[];
  selected: string;
  onSelect: (key: string) => void;
  pointLabel: (row: R) => string;
  pointDetail: (row: R) => string;
  rowKey: (row: R) => string;
}) {
  const [lines, setLines] = useState<Record<string, string>>({});
  const def = defs.find((d) => d.key === selected) ?? defs[0];
  const values = rows.map(def.get);
  const s = summarize(values);
  const text = lines[def.key] ?? "";
  const line = parseLine(text);
  const hit = line === null ? null : lineHit(values, line);
  const points: ChartPoint[] = rows.map((r) => ({ key: rowKey(r), label: pointLabel(r), value: def.get(r), detail: pointDetail(r) }));

  return (
    <section className="detail">
      <label className="select">
        <span>Estatística</span>
        <select value={def.key} onChange={(e) => onSelect(e.target.value)}>
          {defs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </label>
      <div className="mini-stats">
        <span>Média <strong>{num(s.avg, 2)}</strong></span>
        <span>Mín <strong>{num(s.min)}</strong></span>
        <span>Máx <strong>{num(s.max)}</strong></span>
        <span className="muted">média em {s.n} {s.n === 1 ? "jogo" : "jogos"}</span>
      </div>
      <LineBox text={text} onText={(t) => setLines({ ...lines, [def.key]: t })} hit={hit} unit={def.short ?? def.label.toLowerCase()} />
      <GamesChart points={points} line={line} title={`${def.label} por jogo`} />
    </section>
  );
}
