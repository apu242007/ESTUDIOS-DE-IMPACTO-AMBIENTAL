import { describe, expect, it } from "vitest";
import { slugKey } from "./catalogs";

describe("slugKey", () => {
  it("quita acentos, pasa a minúsculas y une con guion bajo", () => {
    expect(slugKey("  Cruce de Ductos ")).toBe("cruce_de_ductos");
    expect(slugKey("Línea eléctrica / LMT")).toBe("linea_electrica_lmt");
    expect(slugKey("Año 2026")).toBe("ano_2026");
  });
  it("devuelve vacío si no hay letras ni números", () => {
    expect(slugKey("—!!")).toBe("");
  });
});
