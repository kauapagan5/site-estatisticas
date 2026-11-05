import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "./filters";
import { fixed, parseLine } from "./format";
import { lineHit, parseMinutes, pct, per90, summarize, sumFields } from "./stats";

describe("média", () => {
  it("ignora jogos sem dado e conta quantos entraram", () => {
    const s = summarize([4, null, 6, undefined, 2]);
    expect(s.avg).toBe(4);
    expect(s.n).toBe(3);
    expect(s.min).toBe(2);
    expect(s.max).toBe(6);
  });
  it("sem nenhum valor = sem dado", () => {
    expect(summarize([null, null]).avg).toBeNull();
  });
});

describe("por 90 minutos", () => {
  it("soma ÷ minutos × 90", () => {
    const r = per90([2, 1, 0], [90, 45, 90]);
    expect(r.value).toBeCloseTo((3 / 225) * 90);
    expect(r.smallSample).toBe(true); // 225 < 270
  });
  it("sem aviso a partir de 270 minutos", () => {
    expect(per90([1, 1, 1], [90, 90, 90]).smallSample).toBe(false);
  });
  it("jogo sem minutos fica fora", () => {
    expect(per90([1, 5], [90, null]).value).toBe(1);
  });
});

describe("% de acerto", () => {
  it("é total acertado ÷ total tentado, não a média das %", () => {
    // 1/1 (100%) e 3/9 (33%) -> média das % seria 66,7%; o certo é 4/10 = 40%
    const r = pct([1, 3], [1, 9]);
    expect(r.pct).toBeCloseTo(0.4);
    expect(r.made).toBe(4);
    expect(r.attempted).toBe(10);
  });
  it("sem tentativa = sem dado", () => {
    expect(pct([0], [0]).pct).toBeNull();
  });
});

describe("taxa de linha", () => {
  it("conta acima e abaixo", () => {
    const r = lineHit([5, 3, 6, 4, 7, 2, 5, 8, 1, 6], 4.5);
    expect(r.over).toBe(6);
    expect(r.under).toBe(4);
    expect(r.n).toBe(10);
    expect(r.rate).toBeCloseTo(0.6);
  });
  it("ignora sem dado e registra empate em linha inteira", () => {
    const r = lineHit([4, null, 5, 3], 4);
    expect(r).toMatchObject({ over: 1, under: 1, push: 1, n: 3 });
  });
});

describe("minutos da NBA", () => {
  it("converte mm:ss", () => {
    expect(parseMinutes("34:12")).toBe(34.2);
    expect(parseMinutes("37")).toBe(37);
    expect(parseMinutes(null)).toBeNull();
  });
});

describe("PRA", () => {
  it("soma pontos, rebotes e assistências", () => {
    expect(sumFields({ pts: 30, reb: 5, ast: 7 }, ["pts", "reb", "ast"])).toBe(42);
    expect(sumFields({ pts: 30, reb: null, ast: 7 }, ["pts", "reb", "ast"])).toBeNull();
  });
});

describe("filtros", () => {
  const games = [
    { date: "2026-10-01", home: true, starter: true, league_id: 39 },
    { date: "2026-10-08", home: false, starter: false, league_id: 39 },
    { date: "2026-10-15", home: true, starter: null, league_id: 2 },
    { date: "2026-10-22", home: true, starter: true, league_id: 39 },
  ];
  it("mais recente primeiro e últimos N", () => {
    const r = applyFilters(games, { ...DEFAULT_FILTERS, window: "5" });
    expect(r.map((g) => g.date)).toEqual(["2026-10-22", "2026-10-15", "2026-10-08", "2026-10-01"]);
  });
  it("casa + titular + competição", () => {
    const r = applyFilters(games, { window: "season", venue: "home", role: "starter", league: 39 });
    expect(r.map((g) => g.date)).toEqual(["2026-10-22", "2026-10-01"]);
  });
});

describe("formato brasileiro", () => {
  it("vírgula decimal e linha digitada com vírgula", () => {
    expect(fixed(3.4)).toBe("3,4");
    expect(parseLine("4,5")).toBe(4.5);
    expect(parseLine("")).toBeNull();
  });
});
