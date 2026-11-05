// Tipos dos JSON gerados por scripts/build_site_data.py e carregamento com cache.
import { useEffect, useState } from "react";

export type N = number | null;

export interface TeamPeriod {
  goals: N; goals_against: N; corners: N; corners_against: N;
  shots_total: N; shots_total_against: N; shots_on: N; shots_on_against: N;
  yellow: N; yellow_against: N; red: N; red_against: N;
  fouls?: N; offsides?: N; possession?: N;
}
export interface FootballTeamGame {
  fixture_id: number; date: string; league_id: number; home: boolean;
  opp_id: number; opp: string | null; gf: N; ga: N;
  FT?: TeamPeriod; "1T"?: TeamPeriod; "2T"?: TeamPeriod;
}
export interface FootballTeamFile {
  team: { id: number; name: string; logo: string | null; league_id: number; league: string | null };
  games: FootballTeamGame[];
}
export interface FootballPlayerGame {
  fixture_id: number; date: string; league_id: number; home: boolean; team_id: number;
  opp_id: number; opp: string | null; gf: N; ga: N;
  played: boolean; minutes: N; starter: boolean | null;
  shots_total: N; shots_on: N; goals: N; assists: N; key_passes: N;
  dribbles_success: N; dribbles_attempts: N; fouls_drawn: N; fouls_committed: N; yellow: N; red: N;
}
export interface FootballPlayerFile {
  player: { id: number; name: string; photo: string | null; team_id: number; team: string | null;
    team_logo: string | null; position: string | null; league_id: number | null };
  games: FootballPlayerGame[];
}
export interface Fixture {
  id: number; date: string; league_id: number; home_id: number; home: string; home_logo: string | null;
  away_id: number; away: string; away_logo: string | null; gh: N; ga: N; status: string; collected: boolean;
}
export interface LeagueFile {
  league: { id: number; slug: string; name: string };
  teams: { id: number; name: string; logo: string | null;
    games: ({ date: string; home: boolean } & Record<"FT" | "1T" | "2T", Partial<TeamPeriod>>)[] }[];
}
export interface NbaGame {
  id: number; season: number; date: string; home_id: number; home: string; away_id: number; away: string;
  pts_home: N; pts_away: N; quarters_home: N[]; quarters_away: N[];
}
export interface NbaTeamGame {
  game_id: number; date: string; home: boolean; opp_id: number; opp: string | null;
  pts: N; pts_against: N; quarters: N[]; quarters_against: N[];
  tpm: N; tpa: N; reb: N; ast: N; team_stats_source: string;
}
export interface NbaTeamFile { team: { id: number; name: string; code: string | null; logo: string | null }; games: NbaTeamGame[] }
export interface NbaPlayerGame {
  game_id: number; date: string; home: boolean; team_id: number; opp_id: number; opp: string | null;
  pts_team: N; pts_opp: N; played: boolean; minutes: N;
  pts: N; reb: N; ast: N; stl: N; blk: N; tov: N; fgm: N; fga: N; tpm: N; tpa: N; ftm: N; fta: N;
}
export interface NbaPlayerFile {
  player: { id: number; name: string; team_id: number; team: string | null; team_logo: string | null; position: string | null };
  games: NbaPlayerGame[];
}
export interface NbaLeagueFile {
  teams: { id: number; name: string; logo: string | null;
    games: { date: string; home: boolean; pts: N; pts_against: N; tpm: N; tpa: N; reb: N; ast: N }[] }[];
}
export interface IndexItem { t: "team" | "player"; s: "football" | "nba"; id: number; name: string; q: string; sub: string; img: string | null }
export interface Meta {
  generated_at: string; last_data_update: string | null; sources: string[];
  football_leagues: { id: number; slug: string; name: string }[];
}

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(`./data/${path}`).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "não encontrado" : `erro ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export type Loaded<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ok"; data: T };

export function useJson<T>(path: string | null): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setState({ status: "loading" });
    loadJson<T>(path).then(
      (data) => alive && setState({ status: "ok", data }),
      (e: Error) => alive && setState({ status: "error", error: e.message }),
    );
    return () => { alive = false; };
  }, [path]);
  return state;
}

/** Busca tolerante a acento e maiúscula. */
export function normalize(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
