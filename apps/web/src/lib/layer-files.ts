export const layerFormats = ["shp", "kmz", "kml"] as const;
export type LayerFormat = (typeof layerFormats)[number];

/** Extensiones aceptadas al subir capas (subconjunto de la lista blanca de Storage, A.10). */
export const layerExts = ["shp", "dbf", "shx", "prj", "cpg", "qix", "qmd", "kmz", "kml"] as const;
export const SHP_REQUIRED = ["shp", "shx", "dbf", "prj"] as const;

export type LayerFileRef = { path: string; ext: string; size: number };

export type LayerGroup = {
  baseName: string;
  format: LayerFormat;
  files: File[];
  /** Extensiones de un SHP que faltan (vacío para KMZ/KML). */
  missing: string[];
};

/** Storage rechaza claves con tildes o ñ ("Invalid key"): sin diacríticos y el resto de lo raro a "_". */
export const storageName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .()-]/g, "_");

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const stemOf = (name: string) => name.slice(0, name.lastIndexOf(".")).toLowerCase();

/** Agrupa archivos sueltos por nombre base. Devuelve también los que se descartaron. */
export function groupLayerFiles(files: File[]): { groups: LayerGroup[]; ignored: string[] } {
  const byStem = new Map<string, File[]>();
  const ignored: string[] = [];
  for (const f of files) {
    if (!(layerExts as readonly string[]).includes(extOf(f.name))) {
      ignored.push(f.name);
      continue;
    }
    const k = stemOf(f.name);
    byStem.set(k, [...(byStem.get(k) ?? []), f]);
  }

  const groups: LayerGroup[] = [];
  for (const list of byStem.values()) {
    const exts = list.map((f) => extOf(f.name));
    const main = list.find((f) => ["shp", "kmz", "kml"].includes(extOf(f.name)));
    if (!main) {
      ignored.push(...list.map((f) => f.name)); // sidecars sin archivo principal
      continue;
    }
    const format = extOf(main.name) as LayerFormat;
    groups.push({
      baseName: main.name.slice(0, main.name.lastIndexOf(".")),
      format,
      files: list,
      missing: format === "shp" ? SHP_REQUIRED.filter((e) => !exts.includes(e)) : [],
    });
  }
  return { groups, ignored };
}

/** Sugeridos para confirmar el CRS de una capa sin .prj (A.7: sugerir 22182). */
export const crsOptions = [
  { epsg: 22182, label: "POSGAR 94 faja 2 (22182) — sugerido" },
  { epsg: 22181, label: "POSGAR 94 faja 1 (22181)" },
  { epsg: 22183, label: "POSGAR 94 faja 3 (22183)" },
  { epsg: 4326, label: "WGS84 lat/long (4326)" },
] as const;
