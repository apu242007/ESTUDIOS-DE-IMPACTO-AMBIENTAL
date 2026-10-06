import { describe, expect, it } from "vitest";
import { joinViews, pickCategory, splitViews } from "./photos";

describe("vistas de foto", () => {
  it("une y separa como la ficha en papel", () => {
    expect(joinViews(["O", "NO"])).toBe("O-NO");
    expect(splitViews("S-O")).toEqual(["S", "O"]);
  });
  it("vacío y basura no rompen", () => {
    expect(joinViews([])).toBeNull();
    expect(splitViews(null)).toEqual([]);
    expect(splitViews("X-Y-N")).toEqual(["N"]);
  });
});

describe("categoría de las fotos nuevas", () => {
  const keys = ["cruces", "caminos", "otros"];
  it("usa la última si sigue en el catálogo", () => {
    expect(pickCategory(keys, "caminos")).toBe("caminos");
  });
  it("nunca guarda una categoría que el desplegable no muestra", () => {
    expect(pickCategory(keys, "otro")).toBe("cruces");
    expect(pickCategory(keys, null)).toBe("cruces");
  });
  it("sin catálogo conserva la recordada o cae en 'otro'", () => {
    expect(pickCategory([], "caminos")).toBe("caminos");
    expect(pickCategory([], null)).toBe("otro");
  });
});
