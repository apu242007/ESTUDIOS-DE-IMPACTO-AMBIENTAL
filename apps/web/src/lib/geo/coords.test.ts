import { describe, expect, it } from "vitest";
import { fromPosgarFaja2, toPosgarFaja2, marcasEste } from "./coords";

const LAT = -(38 + 7 / 60 + 47.78 / 3600);
const LON = -(68 + 34 / 60 + 8.97 / 3600);

describe("POSGAR faja 2 (EPSG:22182)", () => {
  it("coincide con pyproj/PROJ (EPSG:4326 -> 22182) al centímetro", () => {
    const { x, y } = toPosgarFaja2(LAT, LON);
    expect(Math.abs(x - 5779957.1)).toBeLessThan(0.05);
    expect(Math.abs(y - 2537775.1)).toBeLessThan(0.05);
  });
  it("punto de A.7 del informe: X (norte) ~5779960, Y (este) ~2537773 (tolerancia 5 m)", () => {
    // el informe redondea y usa coordenadas de GPS de mano: difiere unos metros del cálculo exacto
    const { x, y } = toPosgarFaja2(LAT, LON);
    expect(Math.abs(x - 5779960)).toBeLessThan(5);
    expect(Math.abs(y - 2537773)).toBeLessThan(5);
  });
  it("norte medido desde el polo (lat_0=-90): ecuador en el meridiano central = cuarto de meridiano", () => {
    const { x, y } = toPosgarFaja2(0, -69);
    expect(x).toBeCloseTo(10001965.729, 2);
    expect(y).toBeCloseTo(2500000, 3);
  });
  it("latitud -38 sobre el meridiano central coincide con PROJ", () => {
    expect(toPosgarFaja2(-38, -69).x).toBeCloseTo(5794467.71, 1);
  });
  it("la inversa recupera lat/lon", () => {
    const { x, y } = toPosgarFaja2(LAT, LON);
    const r = fromPosgarFaja2(x, y);
    expect(r.lat).toBeCloseTo(LAT, 9);
    expect(r.lon).toBeCloseTo(LON, 9);
  });
});

describe("marcas del marco del pliego", () => {
  it("devuelve Y (este) cada 500 m alrededor del centro, redondeadas al múltiplo", () => {
    const t = marcasEste(-(38 + 7 / 60 + 47.78 / 3600), -(68 + 34 / 60 + 8.97 / 3600)); // Y ≈ 2.537.775
    expect(t).toEqual([2535500, 2536000, 2536500, 2537000, 2537500, 2538000, 2538500, 2539000, 2539500]);
  });
});
