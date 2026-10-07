import type { CheckItem } from "@/lib/checklist";
import type { ProjectRow } from "@/lib/schemas";

/** Las seis fases del trabajo, en orden. Las cuatro primeras agrupan ítems del checklist; Control y Entrega
 * no tienen ítems y salen del estado del proyecto (revisión → controlado; entregado/cerrado → entregado). */
export const FASES = [
  { titulo: "Preparar", items: ["datos", "alcance", "capas"] },
  { titulo: "Campo", items: ["relevamiento", "gps"] },
  { titulo: "Resultados", items: ["geometria", "fotos"] },
  { titulo: "Contenido", items: ["impactos", "ambiente", "pga"] },
  { titulo: "Control", items: [] },
  { titulo: "Entrega", items: [] },
] as const;

type Estado = ProjectRow["status"];
export type AvanceFase = { titulo: string; listos: number; total: number };

const controlado = (s: Estado) => s !== "borrador";
const entregado = (s: Estado) => s === "entregado" || s === "cerrado";

export function porFase(items: CheckItem[], estado: Estado): AvanceFase[] {
  return FASES.map((f, i) => {
    if (i === 4) return { titulo: f.titulo, listos: controlado(estado) ? 1 : 0, total: 1 };
    if (i === 5) return { titulo: f.titulo, listos: entregado(estado) ? 1 : 0, total: 1 };
    const deFase = items.filter((it) => (f.items as readonly string[]).includes(it.id));
    return { titulo: f.titulo, listos: deFase.filter((it) => it.done).length, total: deFase.length };
  });
}

/** Índice de la fase que tiene el próximo paso pendiente; null si ya está todo entregado. */
export function faseActiva(items: CheckItem[], estado: Estado): number | null {
  const i = porFase(items, estado).findIndex((f) => f.listos < f.total);
  return i === -1 ? null : i;
}
