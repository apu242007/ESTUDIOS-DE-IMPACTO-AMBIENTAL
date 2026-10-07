import { describe, expect, it } from "vitest";
import { applySkipped, buildChecklist, nextStep, progress, sectionStatus, type Counts } from "./checklist";

const vacio: Counts = {
  applicantOk: false, missingDatos: ["Razón social del solicitante"], works: 0, worksWithGeom: 0, layerStatuses: [],
  lines: 0, linesClosed: 0, waypoints: 0, waypointsMatched: 0, gpsStatuses: [], photos: 0,
  impacts: 0, zoneKey: null, measuresSelected: 0,
};
const completo: Counts = {
  applicantOk: true, missingDatos: [], works: 12, worksWithGeom: 12, layerStatuses: ["listo", "listo"],
  lines: 3, linesClosed: 3, waypoints: 40, waypointsMatched: 40, gpsStatuses: ["listo"], photos: 120,
  impacts: 132, zoneKey: "bajada_del_palo_oeste", measuresSelected: 40,
};

describe("lista de chequeo", () => {
  it("proyecto nuevo: nada listo y el primer paso son los datos", () => {
    const items = buildChecklist(vacio);
    expect(progress(items)).toEqual({ done: 0, total: 10 });
    expect(nextStep(items)?.id).toBe("datos");
    expect(items[0].detail).toContain("Razón social del solicitante");
  });

  it("proyecto completo: todo listo y sin siguiente paso", () => {
    const items = buildChecklist(completo);
    expect(progress(items).done).toBe(items.length);
    expect(nextStep(items)).toBeNull();
  });

  it("obras sin geometría y fichas abiertas se cuentan y se explican", () => {
    const items = buildChecklist({ ...completo, worksWithGeom: 9, linesClosed: 1 });
    const geom = items.find((i) => i.id === "geometria")!;
    const rel = items.find((i) => i.id === "relevamiento")!;
    expect(geom.done).toBe(false);
    expect(geom.detail).toContain("3 obras sin geometría");
    expect(rel.detail).toContain("2 fichas abiertas");
  });

  it("una capa con error o sin CRS bloquea 'capas' aunque otras estén listas", () => {
    const items = buildChecklist({ ...completo, layerStatuses: ["listo", "requiere_crs"] });
    const capas = items.find((i) => i.id === "capas")!;
    expect(capas.done).toBe(false);
    expect(capas.detail).toContain("1 capa necesita atención");
  });

  it("GPS: se decide por los datos, no por el registro del archivo", () => {
    const gps = (c: Counts) => buildChecklist(c).find((i) => i.id === "gps")!;
    // todos los waypoints de campo cruzados: listo aunque el archivo se haya quitado (las posiciones se conservan)
    expect(gps({ ...completo, gpsStatuses: [] })).toMatchObject({ done: true });
    // faltan y no hay archivo procesado: pide el .gdb
    expect(gps({ ...completo, gpsStatuses: [], waypointsMatched: 0 })).toMatchObject({ done: false });
    expect(gps({ ...completo, gpsStatuses: [], waypointsMatched: 0 }).detail).toContain(".gdb");
    // hay archivo pero quedaron algunos sin cruzar: los cuenta
    expect(gps({ ...completo, waypointsMatched: 37 }).detail).toContain("3 waypoints sin posición GPS");
  });

  it("estado por sección: cada sección refleja sus propios ítems", () => {
    const s = sectionStatus(buildChecklist({ ...completo, photos: 0 }));
    expect(s.fotos).toBe("falta");
    expect(s.relevamiento).toBe("ok"); // las fichas están cerradas: las fotos ya no la arrastran
    expect(s.datos).toBe("ok");
  });

  it("'falta' gana si una sección tiene varios ítems y alguno falta", () => {
    // 'comparacion' agrupa geometría de obras; con obras sin geometría queda en falta aunque haya obras
    const s = sectionStatus(buildChecklist({ ...completo, worksWithGeom: 0 }));
    expect(s.comparacion).toBe("falta");
  });

  it("singular y plural", () => {
    expect(buildChecklist({ ...completo, works: 1, worksWithGeom: 1 }).find((i) => i.id === "alcance")!.detail).toBe("1 obra cargada.");
  });
});

describe("contenido del informe", () => {
  it("matriz, ambiente y PGA se marcan según lo cargado", () => {
    const items = buildChecklist({ ...completo, impacts: 0, zoneKey: null, measuresSelected: 0 });
    const por = (id: string) => items.find((i) => i.id === id)!;
    expect(por("impactos").done).toBe(false);
    expect(por("ambiente").detail).toContain("zona");
    expect(por("pga").detail).toContain("sugerirlas");
    const listo = buildChecklist(completo);
    expect(listo.find((i) => i.id === "impactos")!.detail).toBe("132 impactos cargados.");
    expect(listo.find((i) => i.id === "pga")!.done).toBe(true);
  });

  it("un paso omitido cuenta como listo, deja de ser el siguiente y conserva su detalle", () => {
    const faltaGps = { ...completo, waypointsMatched: 32 };
    const items = applySkipped(buildChecklist(faltaGps), ["gps"]);
    const gps = items.find((i) => i.id === "gps")!;
    expect(gps).toMatchObject({ done: true, skipped: true });
    expect(gps.detail).toContain("8 waypoints sin posición GPS");
    expect(nextStep(items)).toBeNull();
    expect(progress(items).done).toBe(progress(items).total);
  });

  it("omitir un paso ya listo no lo marca como omitido", () => {
    const items = applySkipped(buildChecklist(completo), ["gps"]);
    expect(items.find((i) => i.id === "gps")?.skipped).toBeFalsy();
  });
});
