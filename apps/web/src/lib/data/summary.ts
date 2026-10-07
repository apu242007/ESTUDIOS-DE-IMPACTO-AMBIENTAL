import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/schemas";
import { applySkipped, buildChecklist, type CheckItem, type Counts } from "@/lib/checklist";

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
  return applySkipped(buildChecklist(counts), project.skipped_steps ?? []);
}

type ProgressRow = {
  project_id: string; works: number; works_geom: number; layer_statuses: string[]; lines: number; lines_closed: number;
  waypoints: number; waypoints_matched: number; gps_statuses: string[]; photos: number; impacts: number; measures: number;
};

/** Checklist de todos los proyectos de la organización en una consulta (vista project_progress, 0022). */
export async function listChecklists(orgId: string, projects: ProjectRow[]): Promise<Map<string, CheckItem[]>> {
  const { data, error } = await createClient().from("project_progress").select("*").eq("org_id", orgId);
  if (error) throw new Error(error.message);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out = new Map<string, CheckItem[]>();
  for (const r of (data ?? []) as ProgressRow[]) {
    const p = byId.get(r.project_id);
    if (!p) continue;
    const missing = missingDatos(p);
    out.set(r.project_id, applySkipped(buildChecklist({
      applicantOk: missing.length === 0, missingDatos: missing, works: r.works, worksWithGeom: r.works_geom,
      layerStatuses: r.layer_statuses, lines: r.lines, linesClosed: r.lines_closed, waypoints: r.waypoints,
      waypointsMatched: r.waypoints_matched, gpsStatuses: r.gps_statuses, photos: r.photos, impacts: r.impacts,
      zoneKey: p.zone_key ?? null, measuresSelected: r.measures,
    }), p.skipped_steps ?? []));
  }
  return out;
}

/** Waypoints con posición y estado del cruce GPS, para la traza del tablero. */
export async function listWaypointsTraza(projectId: string) {
  const { data, error } = await createClient()
    .from("waypoints_view").select("line_id, number, lat, lon, matched").eq("project_id", projectId).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as { line_id: string; number: number | null; lat: number | null; lon: number | null; matched: boolean }[];
}
