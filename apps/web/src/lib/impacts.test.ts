import { describe, expect, it } from "vitest";
import { categoryFor, importance, severityLevel, totalsByAction, weighted, type Category } from "./impacts";

// Categorías cargadas desde el Excel (formato condicional: 25/50/75) con los límites [min, max)
const CATS: Category[] = [
  { label: "Bajo", min_abs: 0, max_abs: 25, applies_to: "negativo" },
  { label: "Moderado", min_abs: 25, max_abs: 50, applies_to: "negativo" },
  { label: "Severo", min_abs: 50, max_abs: 75, applies_to: "negativo" },
  { label: "Crítico", min_abs: 75, max_abs: null, applies_to: "negativo" },
  { label: "Positivo", min_abs: 0, max_abs: null, applies_to: "positivo" },
];

describe("importance — celdas reales de 2947-26_Matriz_YB.xlsx", () => {
  it("Calidad del aire × Traslado de equipos y materiales = −21", () => {
    expect(importance(-1, { IN: 1, EX: 2, MO: 4, PE: 1, RV: 1, SI: 1, AC: 1, EF: 4, PR: 1, MC: 1 })).toBe(-21);
  });
  it("Suelo × Construcción de locaciones y caminos = −40", () => {
    expect(importance(-1, { IN: 4, EX: 2, MO: 4, PE: 4, RV: 4, SI: 1, AC: 1, EF: 4, PR: 4, MC: 2 })).toBe(-40);
  });
  it("Cubierta vegetal × Construcción de locaciones y caminos = −42", () => {
    expect(importance(-1, { IN: 4, EX: 2, MO: 4, PE: 4, RV: 4, SI: 1, AC: 1, EF: 4, PR: 4, MC: 4 })).toBe(-42);
  });
  it("positivo: Actividades económicas × Funcionamiento de los pozos = +39", () => {
    expect(importance(1, { IN: 4, EX: 2, MO: 4, PE: 4, RV: 4, SI: 1, AC: 1, EF: 4, PR: 4, MC: 1 })).toBe(39);
  });
  it("atributos sin elegir cuentan 0", () => {
    expect(importance(-1, { IN: 1 })).toBe(-3);
  });
});

describe("categoryFor", () => {
  it("rangos [min, max): 24 bajo, 25 moderado, 49 moderado, 50 severo, 75 crítico", () => {
    const c = (i: number) => categoryFor(i, CATS);
    expect([c(-24), c(-25), c(-49), c(-50), c(-74), c(-75), c(-120)]).toEqual([
      "Bajo", "Moderado", "Moderado", "Severo", "Severo", "Crítico", "Crítico",
    ]);
  });
  it("los positivos tienen su categoría, sin importar la magnitud; 0 no tiene", () => {
    expect(categoryFor(19, CATS)).toBe("Positivo");
    expect(categoryFor(43, CATS)).toBe("Positivo");
    expect(categoryFor(0, CATS)).toBeNull();
  });
  it("sin catálogo no hay categoría (y no revienta)", () => {
    expect(categoryFor(-30, [])).toBeNull();
  });
});

describe("ponderación por UIP (Matriz Ponderada)", () => {
  it("−21 × 50 UIP = −1,05 y −40 × 80 UIP = −3,2 (celdas G6 y H8 del Excel)", () => {
    expect(weighted(-21, 50)).toBe(-1.05);
    expect(weighted(-40, 80)).toBe(-3.2);
  });
  it("sin UIP no hay valor ponderado", () => {
    expect(weighted(-21, null)).toBeNull();
  });
  it("totales por acción: absoluto y relativo (Traslado de equipos: aire −21 y suelo −23 → −44 / −2,89)", () => {
    const uip = new Map<string, number | null>([["aire", 50], ["suelo", 80]]);
    const t = totalsByAction(
      [{ actionId: "a1", factorId: "aire", importance: -21 }, { actionId: "a1", factorId: "suelo", importance: -23 }],
      uip,
    );
    expect(t.get("a1")).toEqual({ absoluto: -44, relativo: -2.89 });
  });
});

describe("severityLevel", () => {
  it("ordena por gravedad y separa los positivos", () => {
    expect(severityLevel("Bajo", CATS)).toBe(0);
    expect(severityLevel("Crítico", CATS)).toBe(3);
    expect(severityLevel("Positivo", CATS)).toBe("positivo");
    expect(severityLevel(null, CATS)).toBeNull();
  });
});
