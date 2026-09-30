import { describe, expect, it } from "vitest";
import { fillVars, projectVars, unresolved } from "./text-template";

describe("fillVars", () => {
  it("reemplaza {pad} y conserva los párrafos", () => {
    const t = "Las tareas de {pad} son cortas.\n\nEn {pad}, además, hay ductos.";
    expect(fillVars(t, { pad: "PAD 58" })).toBe("Las tareas de PAD 58 son cortas.\n\nEn PAD 58, además, hay ductos.");
  });
  it("variable conocida pero vacía queda vacía; desconocida queda visible", () => {
    expect(fillVars("Área {yacimiento} y {rara}", { yacimiento: "" })).toBe("Área  y {rara}");
  });
  it("números y null", () => {
    expect(fillVars("{n} pozos, {x}", { n: 6, x: null })).toBe("6 pozos, ");
  });
});

describe("projectVars", () => {
  const base = { name: "Perforación de 6 pozos en PAD58", code: "2947-26", field_area: "Bajada del Palo Oeste", province: "Neuquén" };
  it("usa el nombre corto y, si falta, el nombre completo", () => {
    expect(projectVars({ ...base, short_name: "PAD 58" }).pad).toBe("PAD 58");
    expect(projectVars({ ...base, short_name: "  " }).pad).toBe(base.name);
    expect(projectVars(base).pad).toBe(base.name);
  });
  it("expone proyecto, código, yacimiento, provincia y cliente", () => {
    expect(projectVars({ ...base, clientName: "Operadora SA" })).toMatchObject({
      proyecto: base.name, codigo: "2947-26", yacimiento: "Bajada del Palo Oeste", provincia: "Neuquén", cliente: "Operadora SA",
    });
  });
});

describe("unresolved", () => {
  it("lista variables que el sistema no conoce", () => {
    expect(unresolved("{pad} {foo} {foo} {bar}", { pad: "x" })).toEqual(["foo", "bar"]);
  });
});
