/** Cruces por proximidad: de un candidato que devuelve la base a la fila de waypoint "de gabinete". Sin IA. */

export const CROSSING_DISTANCES = [10, 25, 50, 100] as const;
export type CrossingDistance = (typeof CROSSING_DISTANCES)[number];

export type Crossing = {
  featureId: string;
  featureName: string | null;
  layerName: string;
  distM: number;
  crosses: boolean;
  lon: number;
  lat: number;
};

/** Sigla sugerida: los que cruzan van por defecto como "CR" (Cruce) si el catálogo la tiene; el resto sin sigla. */
export function defaultCode(c: Crossing, codes: { code: string }[]): string | null {
  return c.crosses && codes.some((x) => x.code === "CR") ? "CR" : null;
}

/** Descripción armada solo con lo que dice la capa: no agrega contenido técnico. */
export function crossingDescription(c: Crossing): string {
  const de = c.featureName?.trim() ? `${c.layerName} (${c.featureName.trim()})` : c.layerName;
  const d = c.distM.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return c.crosses ? `Cruce con ${de}` : `${de}, a ${d} m de la obra`;
}

export type GabineteWaypoint = {
  description: string;
  code: string | null;
  geom: string; // EWKT, lon primero
  source: "manual";
};

export const toGabineteWaypoint = (c: Crossing, code: string | null): GabineteWaypoint => ({
  description: crossingDescription(c),
  code,
  geom: `SRID=4326;POINT(${c.lon} ${c.lat})`,
  source: "manual",
});

/** Quita los que ya se agregaron antes (misma descripción) para que repetir la búsqueda no duplique. */
export function withoutDuplicates<T extends { description: string }>(rows: T[], existing: Set<string>): T[] {
  const seen = new Set(existing);
  return rows.filter((r) => (seen.has(r.description) ? false : (seen.add(r.description), true)));
}
