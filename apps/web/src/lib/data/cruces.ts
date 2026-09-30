import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toGabineteWaypoint, withoutDuplicates, type Crossing, type CrossingDistance } from "@/lib/cruces";
import { must, ok, parseAll } from "./util";

const rowSchema = z.object({
  feature_id: z.string(),
  feature_name: z.string().nullable(),
  layer_name: z.string(),
  dist_m: z.number(),
  crosses: z.boolean(),
  lon: z.number(),
  lat: z.number(),
});

export async function findCrossings(projectId: string, dist: CrossingDistance): Promise<Crossing[]> {
  const res = await createClient().rpc("nearby_features", { p_project: projectId, p_dist_m: dist });
  return parseAll(rowSchema, must(res) as unknown[]).map((r) => ({
    featureId: r.feature_id, featureName: r.feature_name, layerName: r.layer_name, distM: r.dist_m, crosses: r.crosses, lon: r.lon, lat: r.lat,
  }));
}

const GABINETE = "Gabinete";

/** Tramo de gabinete del proyecto (donde van las interferencias que no salieron del campo). Lo crea si no existe. */
async function gabineteLine(projectId: string): Promise<string> {
  const sb = createClient();
  const found = await sb.from("survey_lines").select("id").eq("project_id", projectId).eq("notes", GABINETE).limit(1);
  const id = (must(found) as { id: string }[])[0]?.id;
  if (id) return id;
  const nuevo = crypto.randomUUID();
  ok(await sb.from("survey_lines").insert({ id: nuevo, project_id: projectId, kind: "gabinete", notes: GABINETE, closed: true }));
  return nuevo;
}

export type CrossingPick = { crossing: Crossing; code: string | null };

/** Crea los waypoints de gabinete (source 'manual') con la coordenada del cruce. Devuelve cuántos agregó. */
export async function addCrossings(projectId: string, picks: CrossingPick[]): Promise<number> {
  const sb = createClient();
  const lineId = await gabineteLine(projectId);
  const existing = await sb.from("waypoints").select("description, sort_order").eq("line_id", lineId);
  const prev = must(existing) as { description: string | null; sort_order: number }[];
  const nuevos = withoutDuplicates(
    picks.map((p) => toGabineteWaypoint(p.crossing, p.code)),
    new Set(prev.map((w) => w.description ?? "")),
  );
  if (nuevos.length === 0) return 0;
  const start = Math.max(0, ...prev.map((w) => w.sort_order));
  ok(
    await sb.from("waypoints").insert(
      nuevos.map((w, i) => ({
        id: crypto.randomUUID(), project_id: projectId, line_id: lineId, number: null, code: w.code, description: w.description,
        geom: w.geom, source: w.source, sort_order: start + i + 1,
      })),
    ),
  );
  return nuevos.length;
}
