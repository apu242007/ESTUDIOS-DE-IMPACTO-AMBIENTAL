import { describe, expect, it } from "vitest";
import { desvios, porFicha, porTipo, topImpactos } from "./tablero";

const obra = (o: Partial<Parameters<typeof desvios>[0][number]>) => ({
  name: "o", declared_length_m: null, declared_area_m2: null, geom_length_m: null, geom_area_m2: null, ...o,
});

describe("perfil de desvíos", () => {
  it("usa el umbral pct O abs_m en longitudes y solo pct en superficies (como Comparación)", () => {
    const r = desvios([
      obra({ name: "Lach", declared_length_m: 160, geom_length_m: 157.8 }),       // −1,38 % pero −2,2 m: dentro
      obra({ name: "Interconexión", declared_area_m2: 3600, geom_area_m2: 3308 }), // −8,1 %: fuera
      obra({ name: "Gas lift", declared_length_m: 1850 }),                          // sin geometría
    ], { pct: 1, abs_m: 5 });
    expect(r.map((x) => [x.name, x.estado])).toEqual([["Lach", "dentro"], ["Interconexión", "fuera"], ["Gas lift", "sin"]]);
    expect(r[0].pct).toBeCloseTo(-1.375, 3);
    expect(r[0].umbralPct).toBeCloseTo(5 / 160 * 100, 3); // el umbral absoluto, pasado a %
    expect(r[1].umbralPct).toBe(1);
  });
});

describe("interferencias por tipo", () => {
  it("agrupa por figura y ordena de más a menos", () => {
    expect(porTipo([{ figura: "Cruce" }, { figura: "Cauce" }, { figura: "Cruce" }])).toEqual([{ figura: "Cruce", n: 2 }, { figura: "Cauce", n: 1 }]);
  });
});

describe("impactos más fuertes", () => {
  it("ordena por importancia absoluta y nombra acción y factor", () => {
    const r = topImpactos(
      [{ action_id: "a1", factor_id: "f1", importance: -21, category: "Compatible" }, { action_id: "a2", factor_id: "f1", importance: -54, category: "Severo" },
       { action_id: "a1", factor_id: "f2", importance: null, category: null }],
      new Map([["a1", "Desmonte"], ["a2", "Perforación"]]), new Map([["f1", "Suelo"], ["f2", "Fauna"]]), 5,
    );
    expect(r).toEqual([
      { accion: "Perforación", factor: "Suelo", importance: -54, category: "Severo" },
      { accion: "Desmonte", factor: "Suelo", importance: -21, category: "Compatible" },
    ]);
  });
});

describe("relevamiento por ficha", () => {
  it("agrupa por ficha en orden de waypoint, cuenta los cruzados y ordena las fichas por número", () => {
    const r = porFicha(
      [
        { line_id: "l2", number: 2, matched: true }, { line_id: "l2", number: 1, matched: false },
        { line_id: "l1", number: 5, matched: true }, { line_id: "lx", number: 1, matched: true },
      ],
      [{ id: "l1", ficha_no: 1, kind: "Ducto" }, { id: "l2", ficha_no: 2, kind: null }],
    );
    expect(r.map((f) => [f.ficha, f.total, f.conGps])).toEqual([[1, 1, 1], [2, 2, 1], [null, 1, 1]]);
    expect(r[1].puntos.map((p) => p.number)).toEqual([1, 2]);
    expect(r[0].tipo).toBe("Ducto");
  });

  it("la ficha de gabinete (cruces sacados de las capas) se marca aparte: no lleva GPS de mano", () => {
    const r = porFicha([{ line_id: "g", number: 1, matched: false }, { line_id: "l1", number: 1, matched: true }],
      [{ id: "g", ficha_no: null, kind: "gabinete" }, { id: "l1", ficha_no: 1, kind: "Ducto" }]);
    expect(r.map((f) => [f.lineId, f.gabinete])).toEqual([["l1", false], ["g", true]]);
  });
});
