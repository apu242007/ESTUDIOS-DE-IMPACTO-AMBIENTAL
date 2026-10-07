import { verdict, type Thresholds } from "@/lib/threshold";

/** Lógica de los tableros del Resumen. Funciones puras: los componentes solo dibujan. */

type Obra = {
  name: string; declared_length_m: number | null; declared_area_m2: number | null; geom_length_m: number | null; geom_area_m2: number | null;
};
export type Desvio = { name: string; unidad: "m" | "m²"; pct: number | null; estado: "dentro" | "fuera" | "sin"; umbralPct: number };

/** Declarado contra calculado, con la misma regla que Comparación: longitudes pct O abs_m, superficies solo pct. */
export function desvios(obras: Obra[], t: Thresholds): Desvio[] {
  return obras.map((o) => {
    const area = o.declared_length_m === null && o.declared_area_m2 !== null;
    const declarado = area ? o.declared_area_m2 : o.declared_length_m;
    const medido = area ? o.geom_area_m2 : o.geom_length_m;
    const unidad = area ? "m²" : "m";
    const umbralPct = area || !declarado ? t.pct : Math.max(t.pct, (t.abs_m / declarado) * 100);
    if (declarado === null || medido === null || declarado === 0) return { name: o.name, unidad, pct: null, estado: "sin", umbralPct };
    const v = verdict(declarado, medido, area ? { pct: t.pct, abs_m: 0 } : t);
    return { name: o.name, unidad, pct: ((medido - declarado) / declarado) * 100, estado: v === "dentro" ? "dentro" : "fuera", umbralPct };
  });
}

export function porTipo(rows: { figura: string }[]): { figura: string; n: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.figura, (m.get(r.figura) ?? 0) + 1);
  return [...m].map(([figura, n]) => ({ figura, n })).sort((a, b) => b.n - a.n || a.figura.localeCompare(b.figura));
}

type Impacto = { action_id: string; factor_id: string; importance: number | null; category: string | null };
export type TopImpacto = { accion: string; factor: string; importance: number; category: string | null };

export function topImpactos(rows: Impacto[], acciones: Map<string, string>, factores: Map<string, string>, n: number): TopImpacto[] {
  return rows
    .filter((r): r is Impacto & { importance: number } => r.importance !== null)
    .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
    .slice(0, n)
    .map((r) => ({ accion: acciones.get(r.action_id) ?? "—", factor: factores.get(r.factor_id) ?? "—", importance: r.importance, category: r.category }));
}

type Wp = { line_id: string; number: number | null; matched: boolean };
type Linea = { id: string; ficha_no: number | null; kind: string | null };
export type Ficha = { lineId: string; ficha: number | null; tipo: string | null; total: number; conGps: number; puntos: { number: number | null; matched: boolean }[] };

/** El relevamiento como esquema: una fila por ficha con sus waypoints en orden y cuántos tienen cruce con el GPS.
 * (Un mapa a escala real no sirve de tablero: con tramos a kilómetros entre sí, todo se aplasta en una franja.) */
export function porFicha(wps: Wp[], lineas: Linea[]): Ficha[] {
  const info = new Map(lineas.map((l) => [l.id, l]));
  const grupos = new Map<string, Wp[]>();
  for (const w of wps) grupos.set(w.line_id, [...(grupos.get(w.line_id) ?? []), w]);
  return [...grupos].map(([lineId, ws]) => ({
    lineId,
    ficha: info.get(lineId)?.ficha_no ?? null,
    tipo: info.get(lineId)?.kind ?? null,
    total: ws.length,
    conGps: ws.filter((w) => w.matched).length,
    puntos: ws.sort((a, b) => (a.number ?? 0) - (b.number ?? 0)).map((w) => ({ number: w.number, matched: w.matched })),
  })).sort((a, b) => (a.ficha ?? Infinity) - (b.ficha ?? Infinity));
}
