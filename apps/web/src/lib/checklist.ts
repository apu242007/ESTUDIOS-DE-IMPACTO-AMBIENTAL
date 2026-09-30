/** Lista de chequeo del proyecto: qué está listo y qué falta para poder entregar el informe. Función pura. */

export type SectionId =
  | "resumen" | "datos" | "alcance" | "capas" | "catastro"
  | "relevamiento" | "gps" | "comparacion" | "mapa" | "interferencias" | "fotos";

export type Counts = {
  applicantOk: boolean;
  missingDatos: string[];          // campos de "Datos" que faltan (nombres legibles)
  works: number;
  worksWithGeom: number;
  layerStatuses: string[];         // estado de cada capa importada
  lines: number;
  linesClosed: number;
  waypoints: number;
  waypointsMatched: number;
  gpsStatuses: string[];           // estado de cada importación GPS
  photos: number;
};

export type CheckItem = {
  id: string;
  section: SectionId;
  label: string;
  done: boolean;
  /** Qué hacer (si falta) o resumen de lo hecho (si está listo). */
  detail: string;
};

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function buildChecklist(c: Counts): CheckItem[] {
  const capasListas = c.layerStatuses.filter((s) => s === "listo" || s === "incompleto").length;
  const capasConProblema = c.layerStatuses.filter((s) => s === "error" || s === "requiere_crs").length;
  const sinGeom = c.works - c.worksWithGeom;
  const abiertas = c.lines - c.linesClosed;
  const sinGps = c.waypoints - c.waypointsMatched;
  const gpsListo = c.gpsStatuses.includes("listo");

  return [
    {
      id: "datos", section: "datos", label: "Datos del proyecto", done: c.missingDatos.length === 0,
      detail: c.missingDatos.length === 0 ? "Solicitante y consultora completos." : `Faltan: ${c.missingDatos.join(", ")}.`,
    },
    {
      id: "alcance", section: "alcance", label: "Alcance de obras", done: c.works > 0,
      detail: c.works > 0 ? `${plural(c.works, "obra cargada", "obras cargadas")}.` : "Cargá las obras del proyecto o pegá el listado del alcance.",
    },
    {
      id: "capas", section: "capas", label: "Capas del cliente", done: capasListas > 0 && capasConProblema === 0,
      detail:
        capasConProblema > 0 ? `${plural(capasConProblema, "capa necesita", "capas necesitan")} atención (error o falta confirmar el CRS).`
        : capasListas > 0 ? `${plural(capasListas, "capa importada", "capas importadas")}.`
        : "Subí las capas SHP o KMZ que entregó el cliente.",
    },
    {
      id: "geometria", section: "comparacion", label: "Obras con geometría", done: c.works > 0 && sinGeom === 0,
      detail:
        c.works === 0 ? "Primero cargá el alcance."
        : sinGeom === 0 ? "Todas las obras tienen su geometría medida."
        : `${plural(sinGeom, "obra sin geometría", "obras sin geometría")}: vinculá elementos de capa a cada una.`,
    },
    {
      id: "relevamiento", section: "relevamiento", label: "Relevamiento de campo", done: c.lines > 0 && abiertas === 0,
      detail:
        c.lines === 0 ? "Todavía no hay fichas de relevamiento."
        : abiertas === 0 ? `${plural(c.lines, "ficha cerrada", "fichas cerradas")}.`
        : `${plural(abiertas, "ficha abierta", "fichas abiertas")}: cerralas al terminar el tramo.`,
    },
    {
      id: "gps", section: "gps", label: "Cruce con el GPS", done: c.waypoints > 0 && gpsListo && sinGps === 0,
      detail:
        c.waypoints === 0 ? "Se cruza cuando haya waypoints relevados."
        : !gpsListo ? "Subí el .gdb del GPS de mano."
        : sinGps === 0 ? "Todos los waypoints tienen posición del GPS."
        : `${plural(sinGps, "waypoint sin posición GPS", "waypoints sin posición GPS")}.`,
    },
    {
      id: "fotos", section: "fotos", label: "Fotos del relevamiento", done: c.photos > 0,
      detail: c.photos > 0 ? `${plural(c.photos, "foto", "fotos")}.` : "Todavía no hay fotos.",
    },
  ];
}

export const nextStep = (items: CheckItem[]): CheckItem | null => items.find((i) => !i.done) ?? null;
export const progress = (items: CheckItem[]) => ({ done: items.filter((i) => i.done).length, total: items.length });

/** Estado por sección para los puntitos de la navegación. Una sección sin ítems no muestra estado. */
export function sectionStatus(items: CheckItem[]): Partial<Record<SectionId, "ok" | "falta">> {
  const out: Partial<Record<SectionId, "ok" | "falta">> = {};
  for (const i of items) out[i.section] = out[i.section] === "falta" || !i.done ? "falta" : "ok";
  return out;
}
