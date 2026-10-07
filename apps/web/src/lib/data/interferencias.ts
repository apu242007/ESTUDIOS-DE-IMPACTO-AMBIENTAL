import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { buildInterferencias, type Interferencias, type LineInfo, type WaypointInput } from "@/lib/interferencias";
import { listCodes } from "./catalogs";
import { changed, must, parseAll } from "./util";

const num = z.number().nullable();
const wpSchema = z.object({
  id: z.string(),
  line_id: z.string(),
  number: num,
  code: z.string().nullable(),
  description: z.string().nullable(),
  views: z.string().nullable(),
  lat: num,
  lon: num,
  elevation_m: num,
});
const lineSchema = z.object({ id: z.string(), ficha_no: num, kind: z.string().nullable() });

/** Bloque de texto del catálogo para la columna Descripción (opcional: si no existe se usa el armado por defecto). */
async function loadTemplate(orgId: string): Promise<string | null> {
  const res = await createClient()
    .from("catalog_text_blocks")
    .select("template")
    .eq("org_id", orgId)
    .eq("scope", "interferencia")
    .eq("key", "interferencia")
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.template as string | undefined) ?? null;
}

/** Quita un cruce de gabinete (solo de esa ficha: los de campo se editan en Relevamiento, que sincroniza el teléfono). */
export async function deleteGabineteWaypoint(id: string, lineId: string): Promise<void> {
  changed(await createClient().from("waypoints").delete().eq("id", id).eq("line_id", lineId).select("id"));
}

export async function loadInterferencias(orgId: string, projectId: string): Promise<Interferencias & { gabinete: Set<string> }> {
  const sb = createClient();
  const [wps, lines, codes, template] = await Promise.all([
    sb
      .from("waypoints_view")
      .select("id, line_id, number, code, description, views, lat, lon, elevation_m")
      .eq("project_id", projectId)
      .limit(5000),
    sb.from("survey_lines").select("id, ficha_no, kind").eq("project_id", projectId),
    listCodes(orgId),
    loadTemplate(orgId),
  ]);
  const waypoints: WaypointInput[] = parseAll(wpSchema, must(wps)).map((w) => ({
    id: w.id,
    lineId: w.line_id,
    number: w.number,
    code: w.code,
    description: w.description,
    views: w.views,
    lat: w.lat,
    lon: w.lon,
    elevationM: w.elevation_m,
  }));
  const lineas = parseAll(lineSchema, must(lines));
  const lineMap = new Map<string, LineInfo>(lineas.map((l) => [l.id, { fichaNo: l.ficha_no }]));
  return {
    ...buildInterferencias(waypoints, new Map(codes.map((c) => [c.code, c.meaning])), lineMap, template),
    // fichas de gabinete: sus cruces salieron de las capas en la oficina y se pueden quitar desde la tabla
    gabinete: new Set(lineas.filter((l) => l.kind === "gabinete").map((l) => l.id)),
  };
}
