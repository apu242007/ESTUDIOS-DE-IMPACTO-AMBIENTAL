import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS as T, parseThresholds, verdict } from "./threshold";

describe("verdict (umbral 1 % o 5 m)", () => {
  it("PAD 58: 85 vs 84 m supera 1 % pero cumple 5 m → dentro", () => {
    expect(verdict(85, 84, T)).toBe("dentro");
  });
  it("PAD 58: 160 vs 158 m → dentro", () => {
    expect(verdict(160, 158, T)).toBe("dentro");
  });
  it("camino troncal 2270 vs 2269 → dentro", () => {
    expect(verdict(2270, 2269, T)).toBe("dentro");
  });
  it("cumple por porcentaje aunque supere 5 m (línea larga)", () => {
    expect(verdict(10000, 10060, T)).toBe("dentro"); // 0,6 %, 60 m
  });
  it("supera ambos → fuera", () => {
    expect(verdict(100, 110, T)).toBe("fuera");
  });
  it("sin declarado o sin medido → sin_dato", () => {
    expect(verdict(null, 50, T)).toBe("sin_dato");
    expect(verdict(50, null, T)).toBe("sin_dato");
    expect(verdict(0, 50, T)).toBe("sin_dato");
  });
});

describe("parseThresholds", () => {
  it("usa los del proyecto si son válidos, si no los por defecto", () => {
    expect(parseThresholds({ pct: 2, abs_m: 10 })).toEqual({ pct: 2, abs_m: 10 });
    expect(parseThresholds({ pct: "x" })).toEqual(T);
    expect(parseThresholds(null)).toEqual(T);
  });
});
