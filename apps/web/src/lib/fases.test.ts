import { describe, expect, it } from "vitest";
import { buildChecklist, type Counts } from "./checklist";
import { FASES, faseActiva, porFase } from "./fases";

const pad58: Counts = {
  applicantOk: true, missingDatos: [], works: 14, worksWithGeom: 14, layerStatuses: ["listo"], lines: 9, linesClosed: 9,
  waypoints: 132, waypointsMatched: 124, gpsStatuses: ["listo"], photos: 305, impacts: 132, zoneKey: "z", measuresSelected: 65,
};

describe("avance por fase", () => {
  it("agrupa el checklist en las seis fases del trabajo", () => {
    expect(FASES.map((f) => f.titulo)).toEqual(["Preparar", "Campo", "Resultados", "Contenido", "Control", "Entrega"]);
    const f = porFase(buildChecklist(pad58), "borrador");
    expect(f.map((x) => x.listos)).toEqual([3, 1, 2, 3, 0, 0]);
    expect(f.map((x) => x.total)).toEqual([3, 2, 2, 3, 1, 1]);
  });

  it("Control y Entrega salen del estado del proyecto", () => {
    const items = buildChecklist(pad58);
    expect(porFase(items, "revision").slice(4).map((x) => x.listos)).toEqual([1, 0]);
    expect(porFase(items, "entregado").slice(4).map((x) => x.listos)).toEqual([1, 1]);
  });

  it("la fase activa es la del siguiente paso (la única que va en amarillo)", () => {
    expect(faseActiva(buildChecklist(pad58), "borrador")).toBe(1); // Campo: falta el cruce GPS
    const listo = buildChecklist({ ...pad58, waypointsMatched: 132 });
    expect(faseActiva(listo, "borrador")).toBe(4); // todo cargado: sigue Control
    expect(faseActiva(listo, "entregado")).toBeNull();
  });
});
