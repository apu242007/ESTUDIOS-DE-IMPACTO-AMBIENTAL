import { describe, expect, it } from "vitest";
import { formatDms, parseDms } from "./dms";

const LAT = -(38 + 7 / 60 + 47.78 / 3600);
const LON = -(68 + 34 / 60 + 8.97 / 3600);

describe("dms", () => {
  it("formatea el punto del informe real", () => {
    expect(formatDms(LAT, LON)).toEqual({ lat: `38° 7'47.78"S`, lon: `68°34'8.97"O` });
  });
  it("hemisferios N y E", () => {
    expect(formatDms(10.5, 20.25)).toEqual({ lat: `10°30'0.00"N`, lon: `20°15'0.00"E` });
  });
  it("carry cuando los segundos redondean a 60", () => {
    expect(formatDms(0.99999999, 0).lat).toBe(`1° 0'0.00"N`);
  });
  it("parseDms invierte formatDms", () => {
    expect(parseDms(`38° 7'47.78"S`)).toBeCloseTo(LAT, 8);
    expect(parseDms(`68°34'8.97"O`)).toBeCloseTo(LON, 8);
    expect(parseDms(`20°15'0.00"E`)).toBeCloseTo(20.25, 8);
    expect(parseDms("basura")).toBeNull();
  });
});
