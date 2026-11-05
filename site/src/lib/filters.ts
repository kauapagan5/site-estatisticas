// Filtros comuns: últimos N, casa/fora, competição, titular/reserva.

export type Window = "5" | "10" | "20" | "season";
export type Venue = "all" | "home" | "away";
export type Role = "all" | "starter" | "bench";

export interface Filters {
  window: Window;
  venue: Venue;
  role: Role;
  league: number | "all";
}

export const DEFAULT_FILTERS: Filters = { window: "10", venue: "all", role: "all", league: "all" };

interface GameLike {
  date: string;
  home: boolean;
  league_id?: number;
  starter?: boolean | null;
}

/**
 * Aplica competição, casa/fora e titular/reserva, e depois pega os N jogos mais recentes.
 * A lista volta do mais recente para o mais antigo.
 */
export function applyFilters<T extends GameLike>(games: T[], f: Filters): T[] {
  const sorted = [...games].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const kept = sorted.filter((g) => {
    if (f.league !== "all" && g.league_id !== undefined && g.league_id !== f.league) return false;
    if (f.venue === "home" && !g.home) return false;
    if (f.venue === "away" && g.home) return false;
    if (f.role === "starter" && g.starter !== true) return false;
    if (f.role === "bench" && g.starter !== false) return false;
    return true;
  });
  return f.window === "season" ? kept : kept.slice(0, Number(f.window));
}
