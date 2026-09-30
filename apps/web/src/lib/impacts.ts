/** Matriz de impactos (Conesa ponderada). Función pura; el trigger calc_impact de la base es la fuente de verdad. */

export const ATTRS = ["IN", "EX", "MO", "PE", "RV", "SI", "AC", "EF", "PR", "MC"] as const;
export type Attr = (typeof ATTRS)[number];
export type Attrs = Partial<Record<Attr, number>>;
export type Sign = 1 | -1;

export const ATTR_LABEL: Record<Attr, string> = {
  IN: "Intensidad", EX: "Extensión", MO: "Momento", PE: "Persistencia", RV: "Reversibilidad",
  SI: "Sinergia", AC: "Acumulación", EF: "Efecto", PR: "Periodicidad", MC: "Recuperabilidad",
};

export type Category = { label: string; min_abs: number; max_abs: number | null; applies_to: "negativo" | "positivo" };

/** I = signo × (3·IN + 2·EX + MO + PE + RV + SI + AC + EF + PR + MC). Igual que la base (paridad probada). */
export function importance(sign: Sign, a: Attrs): number {
  const v = (k: Attr) => a[k] ?? 0;
  return sign * (3 * v("IN") + 2 * v("EX") + v("MO") + v("PE") + v("RV") + v("SI") + v("AC") + v("EF") + v("PR") + v("MC"));
}

/** Categoría por |I| y signo, con rangos [min, max). I = 0 → sin categoría. Igual que el trigger. */
export function categoryFor(imp: number, cats: Category[]): string | null {
  if (imp === 0) return null;
  const grupo = imp < 0 ? "negativo" : "positivo";
  const abs = Math.abs(imp);
  return (
    cats
      .filter((c) => c.applies_to === grupo && abs >= c.min_abs && abs < (c.max_abs ?? 1e9))
      .sort((a, b) => a.min_abs - b.min_abs)[0]?.label ?? null
  );
}

/** Valor ponderado por UIP (unidades de importancia, suman 1000): I × UIP / 1000. Ej. −21 × 50 → −1,05. */
export const weighted = (imp: number, uip: number | null): number | null =>
  uip === null ? null : Math.round(((imp * uip) / 1000) * 100) / 100;

export type Cell = { actionId: string; factorId: string; importance: number };

/** Totales como en "Matriz Ponderada": por acción, suma de I (absoluto) y de I ponderada (relativo). */
export function totalsByAction(cells: Cell[], uipByFactor: Map<string, number | null>) {
  const out = new Map<string, { absoluto: number; relativo: number }>();
  for (const c of cells) {
    const t = out.get(c.actionId) ?? { absoluto: 0, relativo: 0 };
    t.absoluto += c.importance;
    t.relativo += weighted(c.importance, uipByFactor.get(c.factorId) ?? null) ?? 0;
    out.set(c.actionId, t);
  }
  for (const t of out.values()) t.relativo = Math.round(t.relativo * 100) / 100;
  return out;
}

/** Recorte de categorías para dibujar: nivel de gravedad 0 (más leve) … n. Los positivos van aparte. */
export function severityLevel(label: string | null, cats: Category[]): "positivo" | number | null {
  if (!label) return null;
  const c = cats.find((x) => x.label === label);
  if (!c) return null;
  if (c.applies_to === "positivo") return "positivo";
  return cats.filter((x) => x.applies_to === "negativo").sort((a, b) => a.min_abs - b.min_abs).findIndex((x) => x.label === label);
}
