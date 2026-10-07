// Interpreta un listado de alcance pegado como texto (ej. "locación 34.400 m²; camino troncal 2.270 m; ...")
// y propone filas de obras. El usuario confirma/corrige antes de guardar. Sin IA: reglas fijas.

export const workKinds = [
  "locacion",
  "camino",
  "ducto",
  "acueducto_temporal",
  "linea_electrica",
  "fibra_optica",
  "predio",
  "apendice",
  "instalacion_aux",
  "pozo_area",
] as const;
export type WorkKind = (typeof workKinds)[number];

export const workKindLabel: Record<WorkKind, string> = {
  locacion: "Locación",
  camino: "Camino",
  ducto: "Ducto",
  acueducto_temporal: "Acueducto temporal",
  linea_electrica: "Línea eléctrica",
  fibra_optica: "Fibra óptica",
  predio: "Predio",
  apendice: "Apéndice",
  instalacion_aux: "Instalación auxiliar",
  pozo_area: "Pozo / área de pozo",
};

/** Etiqueta de un tipo conocido; un tipo cargado a mano se muestra tal cual. */
export const kindLabel = (k: string): string => workKindLabel[k as WorkKind] ?? k;

export interface ParsedWork {
  kind: string; // un WorkKind inferido, o lo que el usuario escribió a mano
  name: string;
  declared_length_m: number | null;
  declared_area_m2: number | null;
  diameter_in: number | null;
  /** Obras iguales declaradas juntas ("2 líneas de control", "(2)"): lo declarado es por unidad. */
  quantity: number;
}

/** "34.400" -> 34400 ; "2,5" -> 2.5 ; "1.850,5" -> 1850.5 */
export function parseArNumber(raw: string): number {
  const s = raw.trim();
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

const KIND_RULES: [RegExp, WorkKind][] = [
  [/fibra/i, "fibra_optica"],
  [/\bLMT\b|l[ií]nea el[eé]ctrica|media tensi[oó]n/i, "linea_electrica"],
  [/acueducto/i, "acueducto_temporal"],
  [/ap[eé]ndice/i, "apendice"],
  [/predio/i, "predio"],
  [/locaci[oó]n/i, "locacion"],
  [/\bpozos?\b/i, "pozo_area"],
  [/l[ií]nea de (captaci[oó]n|control|gas ?lift)|ducto|gasoducto|oleoducto|gas ?lift/i, "ducto"],
  [/camino|ingreso|egreso|acceso/i, "camino"],
];

export function inferKind(text: string): WorkKind {
  return KIND_RULES.find(([re]) => re.test(text))?.[1] ?? "instalacion_aux";
}

const QTY = /(\d[\d.]*(?:,\d+)?)\s*(km|ha|m²|m2|m)(?![\p{L}\d])/giu;
const DIAM = /(\d+(?:[.,]\d+)?)\s*(?:"|”|″|''|pulg(?:adas)?\b)/i;

export function parseAlcance(text: string): ParsedWork[] {
  const items = text
    .split(/[;\n]+/)
    // quita viñetas y numeración de lista ("-", "•", "3.", "2)") pero no una cantidad ("2 líneas de control")
    .map((s) => s.trim().replace(/^(?:[-•*]+|\d+[.)])\s*/, ""))
    .filter(Boolean);

  const out: ParsedWork[] = [];
  for (const item of items) {
    const matches = [...item.matchAll(QTY)];
    const last = matches.at(-1);
    let length: number | null = null;
    let area: number | null = null;
    if (last) {
      const n = parseArNumber(last[1]);
      const unit = last[2].toLowerCase();
      if (unit === "m") length = n;
      else if (unit === "km") length = n * 1000;
      else if (unit === "ha") area = n * 10000;
      else area = n;
    }
    const d = item.match(DIAM);
    const cant = item.match(/^(\d+)\s+\p{L}+s(?![\p{L}\d])/u) ?? item.match(/\((\d+)\)/);
    const name = last ? item.slice(0, last.index).replace(/[,:\s]+$/, "") : item;
    out.push({
      kind: inferKind(name || item),
      name: (name || item).trim(),
      declared_length_m: length,
      declared_area_m2: area,
      diameter_in: d ? parseArNumber(d[1]) : null,
      quantity: cant ? Math.max(1, Number(cant[1])) : 1,
    });
  }
  return out;
}
