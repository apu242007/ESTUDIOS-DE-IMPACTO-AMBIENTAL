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
      { id: "figuras", label: "Figuras" },
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
  { title: "Entrega", items: [{ id: "control", label: "Control" }, { id: "informe", label: "Informe" }] },
];

export const isSection = (v: string | null): v is SectionId =>
  GROUPS.some((g) => g.items.some((i) => i.id === v));

/** Una línea por pantalla: para qué sirve. El Resumen no la necesita (ya dice qué falta). */
export const SECTION_HELP: Partial<Record<SectionId, string>> = {
  datos: "Solicitante, consultora y yacimiento del proyecto.",
  alcance: "Las obras declaradas por el cliente, con su cantidad y su longitud o superficie por unidad.",
  capas: "Subí los archivos SHP o KMZ del cliente; el sistema calcula las medidas reales.",
  catastro: "Nomenclatura y titulares. Solo lo ven los administradores.",
  relevamiento: "Fichas de campo con waypoints y fotos. Funciona sin conexión.",
  gps: "Subí el .gdb del GPS de mano para cruzar los waypoints.",
  comparacion: "Lo declarado contra lo calculado. El umbral del proyecto se ajusta acá.",
  mapa: "Obras y capas sobre el mapa.",
  figuras: "Mapas que se incrustan en el informe.",
  interferencias: "Tabla de puntos de interés y cruces para el informe.",
  fotos: "Anexo fotográfico por categoría. El epígrafe es opcional: sin él, la foto sale numerada.",
  textos: "Textos del informe a partir de plantillas; podés ajustarlos antes de generar.",
  ambiente: "Descripción del ambiente según la zona del proyecto.",
  impactos: "Matriz de acciones por factores, con la importancia calculada.",
  declaracion: "Declaración de impacto por factor.",
  pga: "Medidas del plan de gestión ambiental.",
  control: "Revisión de calidad antes de generar el informe.",
  informe: "Generá el Word y el PDF, revisá las versiones y aprobá.",
};

/** Secciones en el orden del flujo de trabajo, para "Anterior / Siguiente". */
export const flatSections = (isAdmin: boolean): Section[] =>
  GROUPS.flatMap((g) => g.items).filter((i) => !i.adminOnly || isAdmin);
