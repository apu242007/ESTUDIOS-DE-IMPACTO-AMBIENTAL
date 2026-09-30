import { createClient } from "@/lib/supabase/client";
import { ok } from "@/lib/data/util";
import type { Remote } from "./sync";

const BUCKET = "project-files";
const TABLE = { lines: "survey_lines", waypoints: "waypoints", photos: "photos" } as const;

/** PostgREST acepta EWKT para columnas geometry. Lon primero. */
const point = (lat: number | null, lon: number | null) =>
  lat === null || lon === null ? null : `SRID=4326;POINT(${lon} ${lat})`;

/** Transporte real. org_id lo deriva el trigger desde el proyecto: nunca se manda desde el cliente. */
export const supabaseRemote: Remote = {
  async upsertLine(l) {
    ok(
      await createClient().from("survey_lines").upsert({
        id: l.id,
        project_id: l.projectId,
        work_id: l.workId,
        kind: l.kind,
        start_label: l.startLabel,
        end_label: l.endLabel,
        ficha_no: l.fichaNo,
        job_no: l.jobNo,
        survey_date: l.surveyDate,
        company: l.company,
        dominant: l.dominant,
        cover: l.cover,
        companions: l.companions,
        notes: l.notes,
        closed: l.closed,
      }),
    );
  },

  async upsertWaypoint(w) {
    ok(
      await createClient().from("waypoints").upsert({
        id: w.id,
        project_id: w.projectId,
        line_id: w.lineId,
        number: w.number,
        code: w.code,
        description: w.description,
        views: w.views,
        geom: point(w.lat, w.lon),
        elevation_m: w.elevationM,
        source: w.source,
        sort_order: w.sortOrder,
      }),
    );
  },

  async uploadPhoto(p) {
    const sb = createClient();
    const path = `${p.orgId}/${p.projectId}/photos/${p.id}.jpg`;
    const up = await sb.storage.from(BUCKET).upload(path, p.blob, { upsert: true, contentType: "image/jpeg" });
    if (up.error) throw new Error(`No se pudo subir la foto: ${up.error.message}`);
    ok(
      await sb.from("photos").upsert({
        id: p.id,
        project_id: p.projectId,
        line_id: p.lineId,
        waypoint_id: p.waypointId,
        category: p.category,
        path_original: path,
        caption: p.caption,
        heading: p.heading,
        taken_at: p.takenAt,
      }),
    );
  },

  async remove(table, id) {
    ok(await createClient().from(TABLE[table]).delete().eq("id", id));
  },
};
