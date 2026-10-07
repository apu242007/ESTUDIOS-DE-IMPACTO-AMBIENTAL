import { describe, expect, it } from "vitest";
import { desvios, porTipo, topImpactos, trazas } from "./tablero";

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

describe("traza del relevamiento", () => {
  it("proyecta a GK, separa por ficha en orden de waypoint y cuenta los que no tienen posición", () => {
    const LAT = -38.13, LON = -68.57;
    const t = trazas([
      { line_id: "l1", number: 2, lat: LAT - 0.001, lon: LON + 0.001, matched: true },
      { line_id: "l1", number: 1, lat: LAT, lon: LON, matched: false },
      { line_id: "l2", number: 1, lat: null, lon: null, matched: false },
    ], 400, 200);
    expect(t.sinPosicion).toBe(1);
    expect(t.lineas).toHaveLength(1);
    expect(t.lineas[0].puntos.map((p) => p.number)).toEqual([1, 2]);
    expect(t.lineas[0].puntos[0].matched).toBe(false);
    for (const p of t.lineas[0].puntos) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(400);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(200);
    }
    // el norte va arriba: el waypoint 2 está más al sur, así que su y en pantalla es mayor
    expect(t.lineas[0].puntos[1].y).toBeGreaterThan(t.lineas[0].puntos[0].y);
  });
});
