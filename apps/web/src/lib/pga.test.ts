import { describe, expect, it } from "vitest";
import type { Category } from "./impacts";
import { groupByStage, severeFactors, suggestMeasures, type ImpactLite, type Measure, type MeasureFactor } from "./pga";

const CATS: Category[] = [
  { label: "Bajo", min_abs: 0, max_abs: 25, applies_to: "negativo" },
  { label: "Moderado", min_abs: 25, max_abs: 50, applies_to: "negativo" },
  { label: "Severo", min_abs: 50, max_abs: 75, applies_to: "negativo" },
  { label: "Crítico", min_abs: 75, max_abs: null, applies_to: "negativo" },
  { label: "Positivo", min_abs: 0, max_abs: null, applies_to: "positivo" },
];
const m = (id: string, o: Partial<Measure> = {}): Measure => ({
  id, general: false, stage: "construccion", action: "Acción A", resource: null, timing: null, responsible: null,
  follow_up: null, body: id, sort_order: Number(id.slice(1)), ...o,
});
const MEASURES = [m("m1"), m("m2"), m("m3", { stage: "abandono", action: "Restauración" }), m("g1", { general: true, stage: null })];
const LINKS: MeasureFactor[] = [
  { measure_id: "m1", factor_id: "aire" }, { measure_id: "m2", factor_id: "suelo" },
  { measure_id: "m3", factor_id: "suelo" }, { measure_id: "g1", factor_id: "aire" },
];
// aire: −21 (Bajo); suelo: −40 (Moderado) y −80 (Crítico); fauna: −30 (Moderado); paisaje +36 (positivo)
const IMPACTS: ImpactLite[] = [
  { factor_id: "aire", importance: -21, category: "Bajo" },
  { factor_id: "suelo", importance: -40, category: "Moderado" },
  { factor_id: "suelo", importance: -80, category: "Crítico" },
  { factor_id: "fauna", importance: -30, category: "Moderado" },
  { factor_id: "paisaje", importance: 36, category: "Positivo" },
];

describe("severeFactors", () => {
  it("umbral Moderado: suelo y fauna (no el aire ni los positivos)", () => {
    expect([...severeFactors(IMPACTS, CATS, "Moderado")].sort()).toEqual(["fauna", "suelo"]);
  });
  it("umbral Severo: solo el suelo (tiene un −80 crítico)", () => {
    expect([...severeFactors(IMPACTS, CATS, "Severo")]).toEqual(["suelo"]);
  });
  it("umbral Bajo incluye el aire; los positivos nunca cuentan", () => {
    expect([...severeFactors(IMPACTS, CATS, "Bajo")].sort()).toEqual(["aire", "fauna", "suelo"]);
  });
  it("umbral inexistente → nada", () => {
    expect(severeFactors(IMPACTS, CATS, "Inventado").size).toBe(0);
  });
});

describe("suggestMeasures", () => {
  it("marca las particulares ligadas a factores severos; las generales no se sugieren", () => {
    expect(suggestMeasures(MEASURES, LINKS, IMPACTS, CATS, "Moderado")).toEqual(["m2", "m3"]);
    expect(suggestMeasures(MEASURES, LINKS, IMPACTS, CATS, "Bajo")).toEqual(["m1", "m2", "m3"]);
  });
  it("es determinista: mismo insumo, mismo resultado y mismo orden", () => {
    const a = suggestMeasures([...MEASURES].reverse(), LINKS, IMPACTS, CATS, "Moderado");
    const b = suggestMeasures(MEASURES, [...LINKS].reverse(), [...IMPACTS].reverse(), CATS, "Moderado");
    expect(a).toEqual(b);
  });
  it("sin impactos severos no sugiere nada", () => {
    expect(suggestMeasures(MEASURES, LINKS, [{ factor_id: "aire", importance: -21, category: "Bajo" }], CATS, "Moderado")).toEqual([]);
  });
});

describe("groupByStage", () => {
  it("etapas en orden del proyecto, acciones agrupadas, sin las generales", () => {
    const g = groupByStage(MEASURES);
    expect(g.map((x) => x.stage)).toEqual(["construccion", "abandono"]);
    expect(g[0].actions).toHaveLength(1);
    expect(g[0].actions[0].items.map((i) => i.id)).toEqual(["m1", "m2"]);
  });
});
