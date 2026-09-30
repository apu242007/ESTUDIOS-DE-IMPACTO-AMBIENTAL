import { severityLevel, type Category } from "@/lib/impacts";

export type Measure = {
  id: string;
  general: boolean;
  stage: string | null;
  action: string | null;
  resource: string | null;
  timing: string | null;
  responsible: string | null;
  follow_up: string | null;
  body: string;
  sort_order: number;
};
export type MeasureFactor = { measure_id: string; factor_id: string };
export type ImpactLite = { factor_id: string; importance: number | null; category: string | null };

/** Factores con al menos un impacto NEGATIVO de categoría >= umbral (por posición entre las categorías negativas). */
export function severeFactors(impacts: ImpactLite[], categories: Category[], threshold: string): Set<string> {
  const neg = categories.filter((c) => c.applies_to === "negativo").sort((a, b) => a.min_abs - b.min_abs);
  const min = neg.findIndex((c) => c.label === threshold);
  const out = new Set<string>();
  if (min < 0) return out;
  for (const i of impacts) {
    if ((i.importance ?? 0) >= 0) continue;
    const lvl = severityLevel(i.category, categories);
    if (typeof lvl === "number" && lvl >= min) out.add(i.factor_id);
  }
  return out;
}

/**
 * Sugerencia determinista (sin IA): marca las medidas PARTICULARES vinculadas a algún factor con impacto negativo
 * de categoría >= umbral. Las generales no se sugieren: entran siempre. Mismo insumo → mismo resultado.
 */
export function suggestMeasures(
  measures: Measure[], links: MeasureFactor[], impacts: ImpactLite[], categories: Category[], threshold: string,
): string[] {
  const factores = severeFactors(impacts, categories, threshold);
  if (factores.size === 0) return [];
  const linked = new Set(links.filter((l) => factores.has(l.factor_id)).map((l) => l.measure_id));
  return measures.filter((m) => !m.general && linked.has(m.id)).sort((a, b) => a.sort_order - b.sort_order).map((m) => m.id);
}

export const STAGE_ORDER = ["construccion", "perforacion", "complementarias", "operacion", "abandono"] as const;
export const STAGE_LABEL: Record<string, string> = {
  construccion: "Construcción", perforacion: "Perforación y terminación", complementarias: "Obras complementarias",
  operacion: "Operación", abandono: "Abandono",
};

/** Agrupa por etapa (en el orden del proyecto) y, dentro, por acción, conservando el orden del catálogo. */
export function groupByStage(measures: Measure[]): { stage: string; actions: { action: string; items: Measure[] }[] }[] {
  const out: { stage: string; actions: { action: string; items: Measure[] }[] }[] = [];
  const stages = [...STAGE_ORDER, "sin_etapa"];
  for (const s of stages) {
    const inStage = measures.filter((m) => !m.general && (m.stage ?? "sin_etapa") === s).sort((a, b) => a.sort_order - b.sort_order);
    if (inStage.length === 0) continue;
    const actions: { action: string; items: Measure[] }[] = [];
    for (const m of inStage) {
      const name = m.action ?? "Sin acción";
      const g = actions.find((a) => a.action === name);
      if (g) g.items.push(m);
      else actions.push({ action: name, items: [m] });
    }
    out.push({ stage: s, actions });
  }
  return out;
}
