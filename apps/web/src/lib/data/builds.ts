import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { must, parseAll } from "./util";

const BUCKET = "project-files";

export const buildStatuses = ["pendiente", "procesando", "listo", "error"] as const;
export type BuildStatus = (typeof buildStatuses)[number];
export const buildStatusLabel: Record<BuildStatus, string> = {
  pendiente: "En cola",
  procesando: "Generando",
  listo: "Listo",
  error: "Error",
};

/** Calidad de las fotos del anexo → parámetros que lee el worker (photo_max_px / jpeg_quality). */
export const photoQuality = {
  alta: { label: "Alta (2000 px, archivo pesado)", photo_max_px: 2000, jpeg_quality: 85 },
  media: { label: "Media (1200 px, recomendada)", photo_max_px: 1200, jpeg_quality: 75 },
  baja: { label: "Baja (800 px, archivo liviano)", photo_max_px: 800, jpeg_quality: 65 },
} as const;
export type PhotoQuality = keyof typeof photoQuality;

export const buildSchema = z.object({
  id: z.string(),
  version_num: z.number(),
  status: z.enum(buildStatuses),
  docx_path: z.string().nullable(),
  pdf_path: z.string().nullable(),
  log: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});
export type BuildRow = z.infer<typeof buildSchema>;

export async function listBuilds(projectId: string): Promise<BuildRow[]> {
  const res = await createClient()
    .from("document_builds")
    .select("id, version_num, status, docx_path, pdf_path, log, created_at, finished_at")
    .eq("project_id", projectId)
    .order("version_num", { ascending: false });
  return parseAll(buildSchema, must(res));
}

export async function createBuild(projectId: string, quality: PhotoQuality): Promise<void> {
  const q = photoQuality[quality];
  const { error } = await createClient().rpc("create_document_build", {
    p_project: projectId,
    p_template: null,
    p_params: { photo_max_px: q.photo_max_px, jpeg_quality: q.jpeg_quality },
  });
  if (error) throw new Error(error.message);
}

/** URL firmada de corta vida (Storage privado, A.10) que fuerza la descarga con un nombre útil. */
export async function downloadUrl(path: string, filename: string): Promise<string> {
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 300, { download: filename });
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la descarga");
  return data.signedUrl;
}
