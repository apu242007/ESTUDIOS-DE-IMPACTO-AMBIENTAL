import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/schemas";
import { buildChecklist, type CheckItem, type Counts } from "@/lib/checklist";

const filled = (v: string | undefined) => !!v && v.trim() !== "";

/** Campos de la pestaña Datos que el informe necesita en la carátula. */
export function missingDatos(p: ProjectRow): string[] {
  const out: string[] = [];
  if (!filled(p.applicant.razon_social)) out.push("razón social del solicitante");
  if (!filled(p.consultant.razon_social)) out.push("consultora");
  if (!filled(p.consultant.responsable)) out.push("responsable técnico");
  return out;
}

type Res = { count: number | null; error: { message: string } | null };
const n = (r: Res) => {
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
};

/** Cuenta con consultas livianas (solo `count` y estados): sirve para refrescar la portada seguido. */
export async function getChecklist(project: ProjectRow): Promise<CheckItem[]> {
  const sb = createClient();
  const id = project.id;
  const head = { count: "exact" as const, head: true };

  const [works, worksGeom, layers, lines, wps, wpsGps, gps, photos, impacts, measures] = await Promise.all([
    sb.from("works").select("id", head).eq("project_id", id),
    sb.from("works").select("id", head).eq("project_id", id).not("geom", "is", null),
    sb.from("layer_imports").select("status").eq("project_id", id),
    sb.from("survey_lines").select("closed").eq("project_id", id),
    sb.from("waypoints").select("id", head).eq("project_id", id),
    sb.from("waypoints").select("id", head).eq("project_id", id).eq("matched", true),
    sb.from("gps_imports").select("status").eq("project_id", id),
    sb.from("photos").select("id", head).eq("project_id", id),
    sb.from("project_impacts").select("id", head).eq("project_id", id),
    sb.from("project_measures").select("id", head).eq("project_id", id),
  ]);
  for (const r of [layers, lines, gps]) if (r.error) throw new Error(r.error.message);

  const missing = missingDatos(project);
  const counts: Counts = {
    applicantOk: missing.length === 0,
    missingDatos: missing,
    works: n(works),
    worksWithGeom: n(worksGeom),
    layerStatuses: (layers.data ?? []).map((r) => String(r.status)),
    lines: lines.data?.length ?? 0,
    linesClosed: (lines.data ?? []).filter((r) => r.closed === true).length,
    waypoints: n(wps),
    waypointsMatched: n(wpsGps),
    gpsStatuses: (gps.data ?? []).map((r) => String(r.status)),
    photos: n(photos),
    impacts: n(impacts),
    zoneKey: project.zone_key ?? null,
    measuresSelected: n(measures),
  };
  return buildChecklist(counts);
}
