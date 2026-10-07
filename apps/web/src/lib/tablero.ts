import { toPosgarFaja2 } from "@/lib/geo/coords";
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

type Wp = { line_id: string; number: number | null; lat: number | null; lon: number | null; matched: boolean };
export type PuntoTraza = { number: number | null; x: number; y: number; matched: boolean };

/** Waypoints proyectados a POSGAR faja 2 y escalados a un lienzo w×h con el norte arriba (misma escala en X e Y). */
export function trazas(wps: Wp[], w: number, h: number, margen = 8): { lineas: { lineId: string; puntos: PuntoTraza[] }[]; sinPosicion: number } {
  const con = wps.filter((p) => p.lat !== null && p.lon !== null);
  const gk = con.map((p) => ({ p, ...toPosgarFaja2(p.lat as number, p.lon as number) }));
  if (gk.length === 0) return { lineas: [], sinPosicion: wps.length };
  const norte = gk.map((g) => g.x), este = gk.map((g) => g.y);
  const [n0, n1, e0, e1] = [Math.min(...norte), Math.max(...norte), Math.min(...este), Math.max(...este)];
  const esc = Math.min((w - 2 * margen) / Math.max(e1 - e0, 1), (h - 2 * margen) / Math.max(n1 - n0, 1));
  const ox = (w - (e1 - e0) * esc) / 2, oy = (h - (n1 - n0) * esc) / 2;
  const porLinea = new Map<string, PuntoTraza[]>();
  for (const g of gk) {
    const pt = { number: g.p.number, matched: g.p.matched, x: ox + (g.y - e0) * esc, y: oy + (n1 - g.x) * esc };
    porLinea.set(g.p.line_id, [...(porLinea.get(g.p.line_id) ?? []), pt]);
  }
  return {
    lineas: [...porLinea].map(([lineId, puntos]) => ({ lineId, puntos: puntos.sort((a, b) => (a.number ?? 0) - (b.number ?? 0)) })),
    sinPosicion: wps.length - con.length,
  };
}
