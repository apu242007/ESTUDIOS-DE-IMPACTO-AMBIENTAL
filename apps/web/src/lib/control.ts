import type { SectionId } from "@/lib/checklist";
import { verdict, type Thresholds } from "@/lib/threshold";

/** Control de calidad antes de entregar (Sprint 6 + reglas de contenido del Sprint 10). Función pura. */

export type Severity = "critico" | "advertencia";
export type Finding = { id: string; severity: Severity; title: string; detail: string; section: SectionId };

export type ControlData = {
  project: { name: string; code: string | null; clientName: string | null; applicant: string | null; consultant: string | null };
  thresholds: Thresholds;
  works: { name: string; declaredLength: number | null; declaredArea: number | null; geomLength: number | null; geomArea: number | null }[];
  layers: { name: string; status: string }[];
  lines: { ficha: number | null; closed: boolean }[];
  waypoints: { number: number | null; code: string | null; lat: number | null; lon: number | null; matched: boolean; source: string }[];
  photos: { category: string | null; caption: string | null }[];
  photoCategoryKeys: string[];
  codes: string[];
  center: { lon: number; lat: number } | null;
  impacts: number;
  factorsWithoutDeclaration: string[];
  zoneKey: string | null;
  measuresSelected: number;
  figureKinds: string[];
  hasFinalBuild: boolean;
};

export const AREA_BUFFER_KM = 15;
export const REQUIRED_FIGURES = ["ubicacion", "implantacion", "interferencias"] as const;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const n = (v: number, d = 1) => v.toLocaleString("es-AR", { maximumFractionDigits: d });
const plural = (k: number, s: string, p: string) => `${k} ${k === 1 ? s : p}`;
const lista = (xs: (string | number)[], max = 8) => (xs.length > max ? `${xs.slice(0, max).join(", ")} y ${xs.length - max} más` : xs.join(", "));

export function runControl(d: ControlData): Finding[] {
  const out: Finding[] = [];
  const add = (f: Finding) => out.push(f);

  // 1) campos obligatorios
  const faltan = [
    !d.project.name.trim() && "nombre", !d.project.code?.trim() && "código", !d.project.clientName && "cliente",
    !d.project.applicant?.trim() && "solicitante", !d.project.consultant?.trim() && "consultora",
  ].filter((x): x is string => !!x);
  if (faltan.length) add({ id: "datos", severity: "critico", title: "Faltan datos obligatorios del proyecto", detail: `Falta: ${faltan.join(", ")}.`, section: "datos" });

  // 2) obras: declarado, geometría y umbral
  for (const w of d.works) {
    const esArea = w.declaredLength === null && w.declaredArea !== null;
    const declared = esArea ? w.declaredArea : w.declaredLength;
    const measured = esArea ? w.geomArea : w.geomLength;
    if (declared === null) add({ id: `obra-decl-${w.name}`, severity: "advertencia", title: `“${w.name}” sin longitud ni superficie declarada`, detail: "Cargala en Alcance para poder compararla con lo medido.", section: "alcance" });
    if (w.geomLength === null && w.geomArea === null) {
      add({ id: `obra-geom-${w.name}`, severity: "critico", title: `“${w.name}” sin geometría`, detail: "Vinculá elementos de capa a la obra para medirla.", section: "capas" });
    } else if (declared !== null && verdict(declared, measured, esArea ? { pct: d.thresholds.pct, abs_m: 0 } : d.thresholds) === "fuera") {
      const u = esArea ? "m²" : "m";
      const diff = (measured ?? 0) - declared;
      add({ id: `obra-umbral-${w.name}`, severity: "advertencia", title: `“${w.name}” fuera del umbral`,
        detail: `Declarado ${n(declared)} ${u}, medido ${n(measured ?? 0)} ${u} (diferencia ${diff > 0 ? "+" : ""}${n(diff)} ${u}, ${n((Math.abs(diff) / declared) * 100, 2)} %). Umbral: ${d.thresholds.pct} % o ${d.thresholds.abs_m} m.`, section: "comparacion" });
    }
  }

  // 3) capas
  for (const l of d.layers) {
    if (l.status === "requiere_crs") add({ id: `capa-crs-${l.name}`, severity: "critico", title: `Capa “${l.name}” sin sistema de coordenadas confirmado`, detail: "Confirmá el CRS para procesarla.", section: "capas" });
    else if (l.status === "error") add({ id: `capa-err-${l.name}`, severity: "critico", title: `Capa “${l.name}” con error`, detail: "Revisá el mensaje y reprocesala.", section: "capas" });
    else if (l.status === "incompleto") add({ id: `capa-inc-${l.name}`, severity: "advertencia", title: `Capa “${l.name}” incompleta`, detail: "Le faltan archivos (por ejemplo .prj o .dbf).", section: "capas" });
  }

  // 4) tramos sin cerrar
  const abiertos = d.lines.filter((l) => !l.closed);
  if (abiertos.length) add({ id: "tramos", severity: "critico", title: plural(abiertos.length, "tramo sin cerrar", "tramos sin cerrar"), detail: `Fichas: ${lista(abiertos.map((l) => l.ficha ?? "s/n"))}. Cerralos antes de la versión final.`, section: "relevamiento" });

  // 5) waypoints
  const sinCoord = d.waypoints.filter((w) => w.lat === null || w.lon === null);
  if (sinCoord.length) add({ id: "wp-coord", severity: "advertencia", title: plural(sinCoord.length, "waypoint sin coordenada", "waypoints sin coordenada"), detail: `N°: ${lista(sinCoord.map((w) => w.number ?? "s/n"))}. Subí el GPS o tomá la posición desde el celular.`, section: "gps" });
  const sinGps = d.waypoints.filter((w) => w.lat !== null && !w.matched && w.source !== "manual");
  if (sinGps.length) add({ id: "wp-gps", severity: "advertencia", title: plural(sinGps.length, "waypoint sin cruzar con el GPS", "waypoints sin cruzar con el GPS"), detail: `N°: ${lista(sinGps.map((w) => w.number ?? "s/n"))}. Tienen solo la posición del teléfono.`, section: "gps" });

  // 6) fotos
  const sinEpigrafe = d.photos.filter((p) => !p.caption?.trim()).length;
  if (sinEpigrafe) add({ id: "fotos-epigrafe", severity: "advertencia", title: plural(sinEpigrafe, "foto sin epígrafe", "fotos sin epígrafe"), detail: "Cargalo en Fotos para que salga en el anexo.", section: "fotos" });
  const sinCat = d.photos.filter((p) => !p.category || !d.photoCategoryKeys.includes(p.category)).length;
  if (sinCat) add({ id: "fotos-cat", severity: "advertencia", title: plural(sinCat, "foto sin categoría reconocida", "fotos sin categoría reconocida"), detail: "Asignale una categoría del catálogo.", section: "fotos" });

  // 7) siglas fuera del catálogo
  const raras = [...new Set(d.waypoints.map((w) => w.code).filter((c): c is string => !!c && !d.codes.includes(c)))];
  if (raras.length) add({ id: "siglas", severity: "advertencia", title: "Siglas que no están en el catálogo", detail: `${raras.join(", ")}. Agregalas en Administración → Siglas o corregí el waypoint.`, section: "relevamiento" });

  // 8) fuera del área del proyecto
  if (d.center) {
    const lejos = d.waypoints.filter((w) => w.lat !== null && w.lon !== null && distanceKm(d.center!, { lat: w.lat!, lon: w.lon! }) > AREA_BUFFER_KM);
    if (lejos.length) add({ id: "fuera-area", severity: "advertencia", title: `${plural(lejos.length, "waypoint", "waypoints")} a más de ${AREA_BUFFER_KM} km de las obras`, detail: `N°: ${lista(lejos.map((w) => w.number ?? "s/n"))}. Puede ser un error de coordenadas.`, section: "mapa" });
  }

  // contenido (Sprint 10)
  if (d.impacts === 0) add({ id: "matriz", severity: "critico", title: "Matriz de impactos vacía", detail: "Cargá las celdas de la matriz.", section: "impactos" });
  if (d.impacts > 0 && d.factorsWithoutDeclaration.length) add({ id: "decl", severity: "advertencia", title: plural(d.factorsWithoutDeclaration.length, "factor sin declaración", "factores sin declaración"), detail: lista(d.factorsWithoutDeclaration), section: "declaracion" });
  if (d.measuresSelected === 0) add({ id: "pga", severity: "critico", title: "PGA sin medidas particulares", detail: "Elegí las medidas (podés sugerirlas desde la matriz).", section: "pga" });
  if (!d.zoneKey) add({ id: "ambiente", severity: "advertencia", title: "Ambiente sin zona", detail: "Elegí la zona para cargar la descripción del ambiente.", section: "ambiente" });
  const sinFig = REQUIRED_FIGURES.filter((k) => !d.figureKinds.includes(k));
  if (sinFig.length) add({ id: "figuras", severity: "advertencia", title: plural(sinFig.length, "figura sin generar", "figuras sin generar"), detail: `Faltan: ${sinFig.join(", ")}.`, section: "figuras" });
  if (!d.hasFinalBuild) add({ id: "version", severity: "advertencia", title: "Todavía no hay versión final aprobada", detail: "Las versiones salen con el encabezado BORRADOR hasta que un administrador apruebe.", section: "informe" });

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critico" ? -1 : 1));
}

export const counts = (f: Finding[]) => ({ critico: f.filter((x) => x.severity === "critico").length, advertencia: f.filter((x) => x.severity === "advertencia").length });
