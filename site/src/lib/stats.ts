// Cálculos das médias. Regra geral: null = "sem dado" e fica fora da conta.

export type Num = number | null | undefined;

export interface Summary {
  avg: number | null; // média
  min: number | null;
  max: number | null;
  sum: number;
  n: number; // quantos jogos entraram na conta
}

const isNum = (v: Num): v is number => typeof v === "number" && Number.isFinite(v);

/** Média, mínimo, máximo e soma, ignorando valores ausentes. */
export function summarize(values: Num[]): Summary {
  const nums = values.filter(isNum);
  if (nums.length === 0) return { avg: null, min: null, max: null, sum: 0, n: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return { avg: sum / nums.length, min: Math.min(...nums), max: Math.max(...nums), sum, n: nums.length };
}

export const SMALL_SAMPLE_MINUTES = 270;

/** Média por 90 minutos = soma ÷ soma dos minutos × 90 (só jogos com valor e minutos). */
export function per90(values: Num[], minutes: Num[]): { value: number | null; minutes: number; smallSample: boolean } {
  let sum = 0;
  let mins = 0;
  values.forEach((v, i) => {
    const m = minutes[i];
    if (isNum(v) && isNum(m) && m > 0) {
      sum += v;
      mins += m;
    }
  });
  return { value: mins > 0 ? (sum / mins) * 90 : null, minutes: mins, smallSample: mins < SMALL_SAMPLE_MINUTES };
}

/** % de acerto do período = total acertado ÷ total tentado (não é a média das %). */
export function pct(made: Num[], attempted: Num[]): { made: number; attempted: number; pct: number | null; n: number } {
  let m = 0;
  let a = 0;
  let n = 0;
  made.forEach((v, i) => {
    const t = attempted[i];
    if (isNum(v) && isNum(t)) {
      m += v;
      a += t;
      n += 1;
    }
  });
  return { made: m, attempted: a, pct: a > 0 ? m / a : null, n };
}

export interface LineHit {
  over: number;
  under: number;
  push: number; // igual à linha (só acontece com linha inteira)
  n: number;
  rate: number | null; // over / n
}

/** Taxa de acerto de linha: em quantos jogos o valor ficou acima da linha. */
export function lineHit(values: Num[], line: number): LineHit {
  const nums = values.filter(isNum);
  const over = nums.filter((v) => v > line).length;
  const under = nums.filter((v) => v < line).length;
  const push = nums.length - over - under;
  return { over, under, push, n: nums.length, rate: nums.length ? over / nums.length : null };
}

/** Converte "34:12" em 34,2 minutos. */
export function parseMinutes(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const [m, s] = value.split(":");
  const mins = Number(m);
  const secs = s === undefined ? 0 : Number(s);
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
  return Math.round((mins + secs / 60) * 100) / 100;
}

/** Soma de campos (ex.: PRA = pontos + rebotes + assistências); null se faltar algum. */
export function sumFields(row: Record<string, unknown>, fields: string[]): number | null {
  let total = 0;
  for (const f of fields) {
    const v = row[f];
    if (!isNum(v as Num)) return null;
    total += v as number;
  }
  return total;
}
