import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  findOverlappingRanges,
  sumUip,
  unknownTemplateVariables,
} from "./catalogos";

describe("validaciones de categorias de impacto", () => {
  it("rechaza un maximo igual o menor que el minimo", () => {
    expect(
      categoryInputSchema.safeParse({
        label: "Moderado",
        min_abs: 25,
        max_abs: 25,
        applies_to: "negativo",
        sort_order: 1,
      }).success,
    ).toBe(false);
  });

  it("acepta un rango abierto y rangos contiguos", () => {
    expect(
      categoryInputSchema.safeParse({
        label: "Critico",
        min_abs: 75,
        max_abs: null,
        applies_to: "negativo",
        sort_order: 4,
      }).success,
    ).toBe(true);
    expect(
      findOverlappingRanges([
        { id: "a", label: "Bajo", min_abs: 0, max_abs: 25, applies_to: "negativo" },
        { id: "b", label: "Medio", min_abs: 25, max_abs: 50, applies_to: "negativo" },
      ]),
    ).toEqual([]);
  });

  it("detecta solapamientos solo dentro del mismo signo", () => {
    const overlaps = findOverlappingRanges([
      { id: "a", label: "Bajo", min_abs: 0, max_abs: 30, applies_to: "negativo" },
      { id: "b", label: "Medio", min_abs: 25, max_abs: 50, applies_to: "negativo" },
      { id: "c", label: "Positivo", min_abs: 0, max_abs: null, applies_to: "positivo" },
    ]);
    expect(overlaps).toEqual([["a", "b"]]);
  });
});

describe("suma de UIP", () => {
  it("suma valores numericos y omite nulos", () => {
    expect(sumUip([{ uip: 250 }, { uip: null }, { uip: 750 }])).toBe(1000);
  });
});

describe("variables de plantillas", () => {
  it("informa variables desconocidas sin repetirlas", () => {
    expect(unknownTemplateVariables("{proyecto}: {foo}, {foo}, {cliente} y {bar}")).toEqual(["bar", "foo"]);
  });

  it("acepta todas las variables documentadas", () => {
    expect(unknownTemplateVariables("{pad} {proyecto} {codigo} {yacimiento} {provincia} {cliente}")).toEqual([]);
  });
});
