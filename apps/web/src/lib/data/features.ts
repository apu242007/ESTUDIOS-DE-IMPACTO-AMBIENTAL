import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { changed, must, parseAll } from "./util";

const num = z.number().nullable();
export const featureSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  length_m: num,
  area_m2: num,
  work_id: z.string().nullable(),
});
/** Geometría GeoJSON tal como la devuelve ST_AsGeoJSON (no se re-valida: la emite la base). */
export type Geometry = { type: string; coordinates?: unknown; geometries?: unknown };

export type FeatureRow = z.infer<typeof featureSchema>;

export async function listFeatures(importId: string): Promise<FeatureRow[]> {
  const res = await createClient()
    .from("layer_features")
    .select("id, name, length_m, area_m2, work_id")
    .eq("import_id", importId)
    .order("name");
  return parseAll(featureSchema, must(res));
}

/** Vincula (o desvincula con null) un elemento a una obra; el trigger recalcula la geometría de la obra. */
export async function linkFeature(featureId: string, workId: string | null) {
  changed(await createClient().from("layer_features").update({ work_id: workId }).eq("id", featureId).select("id"));
}

export async function createWellsFromImport(importId: string): Promise<number> {
  const res = await createClient().rpc("create_wells_from_import", { p_import: importId });
  return z.number().parse(must(res));
}

// ---- comparación declarado vs calculado
const compareSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  declared_length_m: num,
  declared_area_m2: num,
  geom_length_m: num,
  geom_area_m2: num,
  diff_length_m: num,
  diff_length_pct: num,
  diff_area_m2: num,
  diff_area_pct: num,
});
export type CompareRow = z.infer<typeof compareSchema>;

export async function listCompare(projectId: string): Promise<CompareRow[]> {
  const res = await createClient()
    .from("works_compare")
    .select(
      "id, name, kind, declared_length_m, declared_area_m2, geom_length_m, geom_area_m2, diff_length_m, diff_length_pct, diff_area_m2, diff_area_pct",
    )
    .eq("project_id", projectId)
    .order("sort_order");
  return parseAll(compareSchema, must(res));
}

// ---- mapa
export type MapFeature = { id: string; name: string | null; src: "capa" | "pozo"; geojson: Geometry };
const geoSchema = z.object({ id: z.string(), name: z.string().nullable(), geojson: z.custom<Geometry>((g) => !!g) });

export async function listMapFeatures(projectId: string): Promise<MapFeature[]> {
  const sb = createClient();
  const [layers, wells] = await Promise.all([
    sb.from("layer_features_geojson").select("id, name, geojson").eq("project_id", projectId).limit(5000),
    sb.from("wells_geojson").select("id, name, geojson").eq("project_id", projectId),
  ]);
  return [
    ...parseAll(geoSchema, must(layers)).map((r) => ({ ...r, src: "capa" as const })),
    ...parseAll(geoSchema, must(wells)).map((r) => ({ ...r, src: "pozo" as const })),
  ];
}
