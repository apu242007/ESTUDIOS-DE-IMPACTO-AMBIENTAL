import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { buildInterferencias, type Interferencias, type LineInfo, type WaypointInput } from "@/lib/interferencias";
import { listCodes } from "./catalogs";
import { must, parseAll } from "./util";

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
const lineSchema = z.object({ id: z.string(), ficha_no: num });

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

export async function loadInterferencias(orgId: string, projectId: string): Promise<Interferencias> {
  const sb = createClient();
  const [wps, lines, codes, template] = await Promise.all([
    sb
      .from("waypoints_view")
      .select("id, line_id, number, code, description, views, lat, lon, elevation_m")
      .eq("project_id", projectId)
      .limit(5000),
    sb.from("survey_lines").select("id, ficha_no").eq("project_id", projectId),
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
  const lineMap = new Map<string, LineInfo>(parseAll(lineSchema, must(lines)).map((l) => [l.id, { fichaNo: l.ficha_no }]));
  return buildInterferencias(waypoints, new Map(codes.map((c) => [c.code, c.meaning])), lineMap, template);
}
