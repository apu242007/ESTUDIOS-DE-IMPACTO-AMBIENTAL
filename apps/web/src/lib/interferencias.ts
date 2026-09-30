import { formatDms } from "@/lib/geo/dms";
import { toPosgarFaja2 } from "@/lib/geo/coords";

export type WaypointInput = {
  id: string;
  lineId: string;
  number: number | null;
  code: string | null;
  description: string | null;
  views: string | null;
  lat: number | null;
  lon: number | null;
  elevationM: number | null;
};

export type LineInfo = { fichaNo: number | null };

export type InterferenciaRow = {
  id: string;
  ficha: number | null;
  number: number | null;
  figura: string;
  lat: string;
  lon: string;
  x: number;
  y: number;
  cota: number | null;
  descripcion: string;
};

export type Interferencias = {
  rows: InterferenciaRow[];
  /** Waypoints del relevamiento que todavía no tienen posición (no entran en la tabla). */
  sinPosicion: number;
};

/** Plantilla con variables `{var}` (A.6.11: el texto del informe sale de plantillas, no de IA). Variable sin valor → vacío. */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""))
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const DEFAULT_FIGURA = "Punto de interés"; // A.8: el informe usa "Punto de interés" cuando no hay sigla

/** Descripción por defecto cuando no hay plantilla en el catálogo: solo junta lo que se cargó, no agrega contenido. */
function descripcionPorDefecto(figura: string, w: WaypointInput): string {
  const partes = [w.description?.trim() ? `${figura}: ${w.description.trim()}` : figura];
  if (w.views) partes.push(`(vistas: ${w.views})`);
  return partes.join(" ");
}

/**
 * Arma la tabla de interferencias del informe. Solo entran waypoints con posición.
 * X = NORTE, Y = ESTE (convención argentina, A.7), redondeados al metro como en el informe.
 */
export function buildInterferencias(
  waypoints: WaypointInput[],
  codes: Map<string, string>,
  lines: Map<string, LineInfo>,
  template?: string | null,
): Interferencias {
  const rows: InterferenciaRow[] = [];
  let sinPosicion = 0;

  for (const w of waypoints) {
    if (w.lat === null || w.lon === null) {
      sinPosicion++;
      continue;
    }
    const figura = (w.code && codes.get(w.code)) || DEFAULT_FIGURA;
    const { x, y } = toPosgarFaja2(w.lat, w.lon);
    const dms = formatDms(w.lat, w.lon);
    rows.push({
      id: w.id,
      ficha: lines.get(w.lineId)?.fichaNo ?? null,
      number: w.number,
      figura,
      lat: dms.lat,
      lon: dms.lon,
      x: Math.round(x),
      y: Math.round(y),
      cota: w.elevationM === null ? null : Math.round(w.elevationM),
      descripcion: template
        ? renderTemplate(template, {
            figura, sigla: w.code, numero: w.number, vistas: w.views, observaciones: w.description,
          })
        : descripcionPorDefecto(figura, w),
    });
  }

  rows.sort((a, b) => (a.ficha ?? 0) - (b.ficha ?? 0) || (a.number ?? 0) - (b.number ?? 0));
  return { rows, sinPosicion };
}

export const CSV_HEADER = ["Figura", "Latitud", "Longitud", "X", "Y", "Cota", "Descripción"] as const;

/** CSV para Excel en es-AR: separador `;`, BOM UTF-8 para que respete las tildes. */
export function toCsv(rows: InterferenciaRow[]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADER.join(";")];
  for (const r of rows) lines.push([r.figura, r.lat, r.lon, r.x, r.y, r.cota, r.descripcion].map(esc).join(";"));
  return "﻿" + lines.join("\r\n");
}
