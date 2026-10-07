import { describe, expect, it } from "vitest";
import { AREA_BUFFER_KM, counts, distanceKm, runControl, type ControlData } from "./control";

const ok: ControlData = {
  project: { name: "PAD 58", code: "2947-26", clientName: "Operadora", applicant: "Operadora SA", consultant: "Consultora SRL" },
  thresholds: { pct: 1, abs_m: 5 },
  works: [{ name: "Camino troncal", declaredLength: 2270, declaredArea: null, geomLength: 2269, geomArea: null }],
  layers: [{ name: "Caminos", status: "listo" }],
  lines: [{ ficha: 1, closed: true }],
  waypoints: [{ number: 4, code: "CR", lat: -38.13, lon: -68.57, matched: true, source: "gps" }],
  photos: [{ category: "locacion", caption: "Vista" }],
  photoCategoryKeys: ["locacion", "pozos"],
  codes: ["CR", "CC"],
  center: { lon: -68.57, lat: -38.13 },
  impacts: 132,
  factorsWithoutDeclaration: [],
  zoneKey: "bajada_del_palo_oeste",
  measuresSelected: 40,
  figureKinds: ["ubicacion", "implantacion", "interferencias"],
  hasFinalBuild: true,
};
const con = (o: Partial<ControlData>): ControlData => ({ ...ok, ...o });
const ids = (d: ControlData) => runControl(d).map((f) => f.id);

describe("control de calidad", () => {
  it("un proyecto completo no tiene hallazgos", () => {
    expect(runControl(ok)).toEqual([]);
  });

  it("datos obligatorios: falta el código y la consultora → crítico", () => {
    const f = runControl(con({ project: { ...ok.project, code: null, consultant: " " } }))[0];
    expect(f).toMatchObject({ id: "datos", severity: "critico", section: "datos" });
    expect(f.detail).toContain("código");
    expect(f.detail).toContain("consultora");
  });

  it("obras: 85 vs 84 m (caso PAD 58) está dentro del umbral; 100 vs 110 m no, y se informan los valores", () => {
    expect(ids(con({ works: [{ name: "Ingreso fractura", declaredLength: 85, declaredArea: null, geomLength: 84, geomArea: null }] }))).toEqual([]);
    const f = runControl(con({ works: [{ name: "Tramo", declaredLength: 100, declaredArea: null, geomLength: 110, geomArea: null }] }))[0];
    expect(f.severity).toBe("advertencia");
    expect(f.detail).toContain("Declarado 100 m, medido 110 m");
    expect(f.detail).toContain("+10 m");
  });

  it("obra sin geometría es crítica; sin declarado es advertencia", () => {
    const r = runControl(con({ works: [{ name: "A", declaredLength: null, declaredArea: null, geomLength: null, geomArea: null }] }));
    expect(r.find((f) => f.id === "obra-geom-A")?.severity).toBe("critico");
    expect(r.find((f) => f.id === "obra-decl-A")?.severity).toBe("advertencia");
  });

  it("capas: sin CRS y con error son críticas; incompleta es advertencia", () => {
    const r = runControl(con({ layers: [{ name: "a", status: "requiere_crs" }, { name: "b", status: "error" }, { name: "c", status: "incompleto" }] }));
    expect(r.map((f) => [f.id, f.severity])).toEqual([
      ["capa-crs-a", "critico"], ["capa-err-b", "critico"], ["capa-inc-c", "advertencia"],
    ]);
  });

  it("tramos abiertos son críticos y listan las fichas", () => {
    const f = runControl(con({ lines: [{ ficha: 1, closed: true }, { ficha: 2, closed: false }, { ficha: 3, closed: false }] }))[0];
    expect(f).toMatchObject({ id: "tramos", severity: "critico" });
    expect(f.title).toBe("2 tramos sin cerrar");
    expect(f.detail).toContain("2, 3");
  });

  it("waypoints sin coordenada y sin cruzar con GPS (los de gabinete no cuentan)", () => {
    const r = runControl(con({ waypoints: [
      { number: 5, code: null, lat: null, lon: null, matched: false, source: "manual" },
      { number: 6, code: null, lat: -38.13, lon: -68.57, matched: false, source: "telefono" },
      { number: null, code: "CR", lat: -38.13, lon: -68.57, matched: false, source: "manual" },   // gabinete
    ] }));
    expect(r.map((f) => f.id).sort()).toEqual(["wp-coord", "wp-gps"]);
    expect(r.find((f) => f.id === "wp-gps")?.title).toBe("1 waypoint sin cruzar con el GPS");
  });

  it("el epígrafe es opcional (el anexo pone \"Foto N.\"); la categoría desconocida sí se avisa", () => {
    const r = runControl(con({ photos: [{ category: "locacion", caption: " " }, { category: "inventada", caption: "x" }, { category: null, caption: "y" }] }));
    expect(r.find((f) => f.id === "fotos-epigrafe")).toBeUndefined();
    expect(r.find((f) => f.id === "fotos-cat")?.title).toBe("2 fotos sin categoría reconocida");
  });

  it("siglas fuera del catálogo", () => {
    const f = runControl(con({ waypoints: [{ number: 1, code: "ZZ", lat: -38.13, lon: -68.57, matched: true, source: "gps" }] })).find((x) => x.id === "siglas");
    expect(f?.detail).toContain("ZZ");
  });

  it(`waypoints a más de ${AREA_BUFFER_KM} km del centro se marcan como fuera de área`, () => {
    const lejos = { number: 9, code: "CR", lat: -38.4, lon: -68.57, matched: true, source: "gps" }; // ~30 km al sur
    expect(ids(con({ waypoints: [lejos] }))).toContain("fuera-area");
    expect(ids(con({ waypoints: [{ ...lejos, lat: -38.14 }] }))).not.toContain("fuera-area");
    expect(ids(con({ center: null, waypoints: [lejos] }))).not.toContain("fuera-area");
  });

  it("contenido: matriz vacía y PGA vacío críticos; ambiente, figuras y versión, advertencias", () => {
    const r = runControl(con({ impacts: 0, measuresSelected: 0, zoneKey: null, figureKinds: ["ubicacion"], hasFinalBuild: false }));
    expect(r.filter((f) => f.severity === "critico").map((f) => f.id).sort()).toEqual(["matriz", "pga"]);
    expect(r.filter((f) => f.severity === "advertencia").map((f) => f.id).sort()).toEqual(["ambiente", "figuras", "version"]);
    expect(r.find((f) => f.id === "figuras")?.detail).toContain("implantacion");
  });

  it("los críticos van primero", () => {
    const r = runControl(con({ zoneKey: null, impacts: 0 }));
    expect(r[0].severity).toBe("critico");
    expect(counts(r)).toEqual({ critico: 1, advertencia: 1 });
  });

  it("distancia: 1° de latitud ≈ 111 km", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0);
  });

  it("un paso omitido queda registrado como advertencia, con lo que faltaba", () => {
    const f = runControl(con({ skipped: [{ id: "gps", label: "Cruce con el GPS", detail: "8 waypoints sin posición GPS.", section: "gps" }] }));
    expect(f).toEqual([expect.objectContaining({
      id: "omitido:gps", severity: "advertencia", title: "Paso omitido: Cruce con el GPS", section: "gps",
    })]);
    expect(f[0].detail).toContain("8 waypoints sin posición GPS");
  });
});
