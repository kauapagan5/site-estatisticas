// Gráfico de barras dos últimos jogos (um por barra), com a linha do usuário sobreposta.
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num } from "../lib/format";

export interface ChartPoint { key: string; label: string; value: number | null; detail: string }

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip-title">{p.detail}</div>
      <div><strong>{num(p.value)}</strong></div>
    </div>
  );
}

export default function GamesChart({ points, line, title }: { points: ChartPoint[]; line: number | null; title: string }) {
  // ordem cronológica da esquerda para a direita
  const data = [...points].reverse();
  const withValue = data.filter((p) => p.value !== null);
  if (withValue.length === 0) return <div className="card"><p className="muted">Sem dados para o gráfico.</p></div>;
  const max = Math.max(...withValue.map((p) => p.value as number), line ?? 0);
  return (
    <figure className="card chart" aria-label={title}>
      <figcaption className="chart-title">
        {title}
        {line !== null && (
          <span className="legend">
            <span className="sw over" /> acima da linha <span className="sw under" /> abaixo
          </span>
        )}
      </figcaption>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-2)" }} tickLine={false}
              axisLine={{ stroke: "var(--grid)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} tickLine={false} axisLine={false}
              allowDecimals={false} domain={[0, Math.ceil(max * 1.1) || 1]} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "var(--hover)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((p) => (
                <Cell key={p.key}
                  fill={line === null ? "var(--series-1)" : (p.value ?? 0) > line ? "var(--series-1)" : "var(--under)"} />
              ))}
            </Bar>
            {line !== null && (
              <ReferenceLine y={line} stroke="var(--text-1)" strokeDasharray="5 4" strokeWidth={2}
                label={{ value: num(line), position: "insideTopRight", fill: "var(--text-1)", fontSize: 12 }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
