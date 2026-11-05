// Formatação no padrão brasileiro: vírgula decimal e datas dd/mm.

const TZ = "America/Sao_Paulo";

export function num(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fixed(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function percent(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}

export function cell(v: number | null | undefined): string {
  return v === null || v === undefined ? "–" : String(v).replace(".", ",");
}

export function ddmm(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

export function hourMin(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** Data de hoje (Brasília) no formato AAAA-MM-DD. */
export function todayBR(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function dayBR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Parse de linha digitada com vírgula ("4,5"). */
export function parseLine(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
