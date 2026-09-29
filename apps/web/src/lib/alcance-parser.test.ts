import { describe, expect, it } from "vitest";
import { inferKind, parseAlcance, parseArNumber } from "./alcance-parser";

describe("parseArNumber", () => {
  it("interpreta separadores argentinos", () => {
    expect(parseArNumber("34.400")).toBe(34400);
    expect(parseArNumber("2.270")).toBe(2270);
    expect(parseArNumber("1.850,5")).toBe(1850.5);
    expect(parseArNumber("2,5")).toBe(2.5);
    expect(parseArNumber("70")).toBe(70);
  });
});

describe("inferKind", () => {
  it("clasifica por palabras clave", () => {
    expect(inferKind("Locación")).toBe("locacion");
    expect(inferKind("Camino troncal")).toBe("camino");
    expect(inferKind("Línea de captación 8\"")).toBe("ducto");
    expect(inferKind("Fibra óptica")).toBe("fibra_optica");
    expect(inferKind("LMT")).toBe("linea_electrica");
    expect(inferKind("Predio TLS")).toBe("predio");
    expect(inferKind("Apéndice acopio de agua de producción")).toBe("apendice");
    expect(inferKind("Algo raro")).toBe("instalacion_aux");
  });
});

describe("parseAlcance", () => {
  const texto = [
    "Locación 34.400 m²",
    "Camino troncal PAD 52 → PAD 58 2.270 m",
    "Ingreso perforación 70 m",
    "Predio TLS 1.300 m²",
    'Línea de captación 8" 1.850 m',
    "Fibra óptica 2.300 m",
  ].join("; ");

  it("extrae superficie, longitud y diámetro", () => {
    const r = parseAlcance(texto);
    expect(r).toHaveLength(6);
    expect(r[0]).toMatchObject({ kind: "locacion", declared_area_m2: 34400, declared_length_m: null });
    expect(r[1]).toMatchObject({ kind: "camino", declared_length_m: 2270 });
    expect(r[3]).toMatchObject({ kind: "predio", declared_area_m2: 1300 });
    expect(r[4]).toMatchObject({ kind: "ducto", declared_length_m: 1850, diameter_in: 8 });
    expect(r[5]).toMatchObject({ kind: "fibra_optica", declared_length_m: 2300 });
  });

  it("acepta un renglón por línea y unidades km/ha", () => {
    const r = parseAlcance("Acueducto 10,5 km\nApéndice 0,5 ha");
    expect(r[0]).toMatchObject({ kind: "acueducto_temporal", declared_length_m: 10500 });
    expect(r[1]).toMatchObject({ kind: "apendice", declared_area_m2: 5000 });
  });

  it("un ítem sin medida queda sin longitud ni superficie", () => {
    const r = parseAlcance("Estación de rebombeo");
    expect(r[0]).toMatchObject({ declared_length_m: null, declared_area_m2: null });
  });
});
