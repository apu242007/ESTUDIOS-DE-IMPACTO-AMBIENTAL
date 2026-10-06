import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { storageName } from "@/lib/layer-files";
import { changed, must, parseAll } from "./util";

const BUCKET = "project-files";

export const gpsKinds = ["gdb", "gpx"] as const;
export type GpsKind = (typeof gpsKinds)[number];
export const gpsStatuses = ["pendiente", "procesando", "listo", "error"] as const;
export type GpsStatus = (typeof gpsStatuses)[number];
export const gpsStatusLabel: Record<GpsStatus, string> = {
  pendiente: "En cola",
  procesando: "Procesando",
  listo: "Listo",
  error: "Error",
};

export const gpsReportSchema = z.object({
  unmatched_points: z.array(z.string()),
  unmatched_waypoints: z.array(z.number()),
  ambiguous: z.array(z.number()),
  duplicates: z.array(z.number()),
});
export type GpsReport = z.infer<typeof gpsReportSchema>;

const num = z.number().nullable();
export const gpsImportSchema = z.object({
  id: z.string(),
  file_path: z.string(),
  file_kind: z.enum(["gdb", "gpx", "kml", "kmz"]),
  status: z.enum(gpsStatuses),
  n_points: num,
  n_matched: num,
  n_unmatched: num,
  report: gpsReportSchema.nullable().catch(null), // un informe con otra forma no debe romper la lista
  error: z.string().nullable(),
  created_at: z.string(),
});
export type GpsImport = z.infer<typeof gpsImportSchema>;

export const gpsKindOf = (name: string): GpsKind | null => {
  const ext = name.split(".").pop()?.toLowerCase();
  return (gpsKinds as readonly string[]).includes(ext ?? "") ? (ext as GpsKind) : null;
};

export async function listGpsImports(projectId: string): Promise<GpsImport[]> {
  const res = await createClient()
    .from("gps_imports")
    .select("id, file_path, file_kind, status, n_points, n_matched, n_unmatched, report, error, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return parseAll(gpsImportSchema, must(res));
}

/** Sube el archivo y recién después crea el registro (el worker reclama la fila apenas existe). */
export async function uploadGps(orgId: string, projectId: string, file: File) {
  const kind = gpsKindOf(file.name);
  if (!kind) throw new Error("Solo se aceptan archivos .gdb (Garmin) o .gpx.");
  const sb = createClient();
  const path = `${orgId}/${projectId}/gps/${crypto.randomUUID()}/${storageName(file.name)}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw new Error(`No se pudo subir ${file.name}: ${up.error.message}`);
  const ins = await sb.from("gps_imports").insert({ project_id: projectId, file_path: path, file_kind: kind, status: "pendiente" });
  if (ins.error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(ins.error.message);
  }
}

/** Reprocesar sirve para volver a cruzar después de agregar waypoints o corregir sus números. */
export async function requeueGps(id: string) {
  changed(await createClient().from("gps_imports").update({ status: "pendiente", error: null }).eq("id", id).select("id"));
}

export async function deleteGps(imp: GpsImport) {
  const sb = createClient();
  changed(await sb.from("gps_imports").delete().eq("id", imp.id).select("id"));
  await sb.storage.from(BUCKET).remove([imp.file_path]); // best-effort: la fila ya no existe
}
