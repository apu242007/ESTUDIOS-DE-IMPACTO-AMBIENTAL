import { describe, expect, it } from "vitest";
import { buildChecklist, nextStep, progress, sectionStatus, type Counts } from "./checklist";

const vacio: Counts = {
  applicantOk: false, missingDatos: ["Razón social del solicitante"], works: 0, worksWithGeom: 0, layerStatuses: [],
  lines: 0, linesClosed: 0, waypoints: 0, waypointsMatched: 0, gpsStatuses: [], photos: 0,
};
const completo: Counts = {
  applicantOk: true, missingDatos: [], works: 12, worksWithGeom: 12, layerStatuses: ["listo", "listo"],
  lines: 3, linesClosed: 3, waypoints: 40, waypointsMatched: 40, gpsStatuses: ["listo"], photos: 120,
};

describe("lista de chequeo", () => {
  it("proyecto nuevo: nada listo y el primer paso son los datos", () => {
    const items = buildChecklist(vacio);
    expect(progress(items)).toEqual({ done: 0, total: 7 });
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

  it("GPS: sin archivo pide el .gdb; con archivo cuenta waypoints sin posición", () => {
    expect(buildChecklist({ ...completo, gpsStatuses: [] }).find((i) => i.id === "gps")!.detail).toContain(".gdb");
    expect(buildChecklist({ ...completo, waypointsMatched: 37 }).find((i) => i.id === "gps")!.detail).toContain("3 waypoints sin posición GPS");
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
