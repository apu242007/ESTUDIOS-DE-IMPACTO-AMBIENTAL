import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { layerFormats, type LayerGroup } from "@/lib/layer-files";
import { changed, must, parseAll } from "./util";

const BUCKET = "project-files";

export const importStatuses = ["pendiente", "requiere_crs", "procesando", "listo", "incompleto", "error"] as const;
export type ImportStatus = (typeof importStatuses)[number];
export const statusLabel: Record<ImportStatus, string> = {
  pendiente: "En cola",
  requiere_crs: "Requiere CRS",
  procesando: "Procesando",
  listo: "Listo",
  incompleto: "Incompleto",
  error: "Error",
};

export const layerImportSchema = z.object({
  id: z.string(),
  base_name: z.string(),
  format: z.enum(layerFormats),
  files: z.array(z.object({ path: z.string(), ext: z.string(), size: z.number() })),
  missing: z.array(z.string()),
  status: z.enum(importStatuses),
  crs_detected: z.string().nullable(),
  crs_confirmed_epsg: z.number().nullable(),
  n_features: z.number().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
});
export type LayerImport = z.infer<typeof layerImportSchema>;

const COLS = "id, base_name, format, files, missing, status, crs_detected, crs_confirmed_epsg, n_features, error, created_at";

export async function listLayerImports(projectId: string): Promise<LayerImport[]> {
  const res = await createClient()
    .from("layer_imports")
    .select(COLS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return parseAll(layerImportSchema, must(res));
}

/**
 * Sube los archivos a `{org}/{proyecto}/layers/{import_id}/` y recién después crea el registro:
 * el worker reclama la fila apenas existe, así que los archivos tienen que estar antes.
 */
export async function uploadLayer(orgId: string, projectId: string, group: LayerGroup) {
  const sb = createClient();
  const importId = crypto.randomUUID();
  const files: { path: string; ext: string; size: number }[] = [];
  for (const f of group.files) {
    const path = `${orgId}/${projectId}/layers/${importId}/${f.name}`;
    const up = await sb.storage.from(BUCKET).upload(path, f, { upsert: false });
    if (up.error) {
      await sb.storage.from(BUCKET).remove(files.map((x) => x.path));
      throw new Error(`No se pudo subir ${f.name}: ${up.error.message}`);
    }
    files.push({ path, ext: f.name.split(".").pop()!.toLowerCase(), size: f.size });
  }
  const ins = await sb.from("layer_imports").insert({
    id: importId,
    project_id: projectId,
    base_name: group.baseName,
    format: group.format,
    files,
    missing: group.missing,
    status: "pendiente",
  });
  if (ins.error) {
    await sb.storage.from(BUCKET).remove(files.map((x) => x.path)); // sin fila no hay quien limpie estos archivos
    throw new Error(ins.error.message);
  }
}

/** Reencola: confirma CRS (opcional) y vuelve a 'pendiente' (único cambio de estado permitido al usuario). */
export async function requeueImport(id: string, crsEpsg?: number) {
  changed(
    await createClient()
      .from("layer_imports")
      .update({ status: "pendiente", error: null, ...(crsEpsg ? { crs_confirmed_epsg: crsEpsg } : {}) })
      .eq("id", id)
      .select("id"),
  );
}

export async function deleteImport(imp: LayerImport) {
  const sb = createClient();
  changed(await sb.from("layer_imports").delete().eq("id", imp.id).select("id"));
  await sb.storage.from(BUCKET).remove(imp.files.map((f) => f.path)); // best-effort: la fila ya no existe
}
