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
  lineId: string;
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

// Misma regla que el informe (apps/worker/app/jobs/docs.py): lo que se revisa en pantalla y en el CSV es lo que recibe el cliente.
// Un quiebre (Q) es un cambio de rumbo, no una interferencia; sin sigla solo entran los puntos de interés (inicio/fin…).
const NO_INTERFERENCIA = new Set(["Q"]);
const PUNTO_DE_INTERES = /^\s*(inicio|fin|finalizaci[oó]n|acometida|empalme)(?![\p{L}\p{N}_])/iu;

export function esInterferencia(code: string | null, obs: string | null): boolean {
  const c = (code ?? "").trim();
  return !NO_INTERFERENCIA.has(c) && (c !== "" || PUNTO_DE_INTERES.test(obs ?? ""));
}

/** Siglas de 2+ letras a texto ("CR con CP" → "Cruce con camino principal"); las de una (O, D…) son ambiguas con rumbos. */
export function expandCodes(text: string, codes: Map<string, string>): string {
  return text.replace(/\b[A-Z][A-Za-z]{1,2}\b/g, (m, offset: number) => {
    const meaning = codes.get(m);
    if (!meaning) return m;
    return offset === 0 ? meaning : meaning.charAt(0).toLowerCase() + meaning.slice(1);
  });
}

/** Descripción por defecto cuando no hay plantilla en el catálogo: solo junta lo que se cargó, no agrega contenido.
 * Las vistas son de las fotos (anexo fotográfico), no de la interferencia. */
function descripcionPorDefecto(figura: string, w: WaypointInput, codes: Map<string, string>): string {
  const code = (w.code ?? "").trim();
  const obs = (w.description ?? "").trim();
  const texto = expandCodes(obs, codes);
  if ((code && obs.startsWith(code)) || (!code && texto)) return texto;
  return texto ? `${figura}: ${texto}` : figura;
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
    if (!esInterferencia(w.code, w.description)) continue;
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
      lineId: w.lineId,
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
        : descripcionPorDefecto(figura, w, codes),
    });
  }

  // la línea desempata, como en el informe: fichas sin número no intercalan sus waypoints
  rows.sort((a, b) =>
    (a.ficha ?? 0) - (b.ficha ?? 0) || a.lineId.localeCompare(b.lineId) || (a.number ?? 0) - (b.number ?? 0));
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
