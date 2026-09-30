import { describe, expect, it } from "vitest";
import { crossingDescription, defaultCode, toGabineteWaypoint, withoutDuplicates, type Crossing } from "./cruces";

const base: Crossing = { featureId: "f1", featureName: "Ducto 8 pulgadas", layerName: "Instalaciones", distM: 0, crosses: true, lon: -68.57, lat: -38.13 };

describe("cruces", () => {
  it("un cruce se describe como cruce; uno cercano dice a cuántos metros", () => {
    expect(crossingDescription(base)).toBe("Cruce con Instalaciones (Ducto 8 pulgadas)");
    expect(crossingDescription({ ...base, crosses: false, distM: 28 })).toBe("Instalaciones (Ducto 8 pulgadas), a 28 m de la obra");
    expect(crossingDescription({ ...base, featureName: null, crosses: false, distM: 30.5 })).toBe("Instalaciones, a 30,5 m de la obra");
  });

  it("sigla por defecto: CR si cruza y el catálogo la tiene; si no, ninguna", () => {
    expect(defaultCode(base, [{ code: "CR" }, { code: "CC" }])).toBe("CR");
    expect(defaultCode(base, [{ code: "CC" }])).toBeNull();
    expect(defaultCode({ ...base, crosses: false }, [{ code: "CR" }])).toBeNull();
  });

  it("el waypoint de gabinete lleva la posición con lon primero y origen manual", () => {
    expect(toGabineteWaypoint(base, "CR")).toEqual({
      description: "Cruce con Instalaciones (Ducto 8 pulgadas)", code: "CR", geom: "SRID=4326;POINT(-68.57 -38.13)", source: "manual",
    });
  });

  it("repetir la búsqueda no duplica los ya agregados ni los repetidos dentro del lote", () => {
    const rows = [{ description: "a" }, { description: "b" }, { description: "a" }, { description: "c" }];
    expect(withoutDuplicates(rows, new Set(["b"])).map((r) => r.description)).toEqual(["a", "c"]);
  });
});
