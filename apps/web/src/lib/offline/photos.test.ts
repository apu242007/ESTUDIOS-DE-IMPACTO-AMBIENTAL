import { describe, expect, it } from "vitest";
import { joinViews, splitViews } from "./photos";

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
