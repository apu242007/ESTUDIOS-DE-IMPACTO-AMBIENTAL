import type { SectionId } from "@/lib/checklist";

export type Section = { id: SectionId; label: string; adminOnly?: boolean };
export type Group = { title: string; items: Section[] };

/** Fases del trabajo, en el orden en que se hacen. */
export const GROUPS: Group[] = [
  { title: "Inicio", items: [{ id: "resumen", label: "Resumen" }] },
  {
    title: "Preparar",
    items: [
      { id: "datos", label: "Datos" },
      { id: "alcance", label: "Alcance" },
      { id: "capas", label: "Capas" },
      { id: "catastro", label: "Catastro", adminOnly: true },
    ],
  },
  {
    title: "Campo",
    items: [
      { id: "relevamiento", label: "Relevamiento" },
      { id: "gps", label: "GPS" },
    ],
  },
  {
    title: "Resultados",
    items: [
      { id: "comparacion", label: "Comparación" },
      { id: "mapa", label: "Mapa" },
      { id: "interferencias", label: "Interferencias" },
      { id: "fotos", label: "Fotos" },
    ],
  },
  {
    title: "Contenido",
    items: [
      { id: "textos", label: "Textos" },
      { id: "ambiente", label: "Ambiente" },
      { id: "impactos", label: "Impactos" },
      { id: "declaracion", label: "Declaración" },
      { id: "pga", label: "PGA" },
    ],
  },
  { title: "Entrega", items: [{ id: "informe", label: "Informe" }] },
];

export const isSection = (v: string | null): v is SectionId =>
  GROUPS.some((g) => g.items.some((i) => i.id === v));
