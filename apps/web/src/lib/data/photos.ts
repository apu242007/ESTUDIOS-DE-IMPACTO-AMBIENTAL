import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { changed, must, parseAll } from "./util";

const BUCKET = "project-files";

export const photoSchema = z.object({
  id: z.string(),
  waypoint_id: z.string().nullable(),
  category: z.string(),
  path_original: z.string().nullable(),
  caption: z.string().nullable(),
  heading: z.string().nullable(),
  taken_at: z.string().nullable(),
  sort_order: z.number(),
});
export type PhotoRow = z.infer<typeof photoSchema> & { url: string | null };

export async function listPhotos(projectId: string): Promise<PhotoRow[]> {
  const sb = createClient();
  const rows = parseAll(
    photoSchema,
    must(
      await sb
        .from("photos")
        .select("id, waypoint_id, category, path_original, caption, heading, taken_at, sort_order")
        .eq("project_id", projectId)
        .order("taken_at", { ascending: true })
        .limit(2000),
    ),
  );
  const paths = rows.map((r) => r.path_original).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600); // Storage privado (A.10)
    if (error) throw new Error(error.message);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  return rows.map((r) => ({ ...r, url: r.path_original ? (urls.get(r.path_original) ?? null) : null }));
}

export async function updatePhoto(id: string, patch: { caption?: string | null; category?: string }) {
  changed(await createClient().from("photos").update(patch).eq("id", id).select("id"));
}

export async function deletePhotoRemote(p: PhotoRow) {
  const sb = createClient();
  changed(await sb.from("photos").delete().eq("id", p.id).select("id"));
  if (p.path_original) await sb.storage.from(BUCKET).remove([p.path_original]); // best-effort: la fila ya no existe
}

/**
 * Fotos sueltas (de gabinete o sin waypoint) subidas desde la sección Fotos: se comprimen y se les quita el EXIF
 * igual que en el relevamiento. Llama a `onProgress` después de cada una; devuelve cuántas subió.
 */
export async function uploadLoosePhotos(
  orgId: string, projectId: string, files: File[], category: string, onProgress?: (hechas: number) => void,
): Promise<number> {
  const { compressPhoto } = await import("@/lib/offline/photos");
  const sb = createClient();
  let hechas = 0;
  for (const f of files) {
    const id = crypto.randomUUID();
    const path = `${orgId}/${projectId}/photos/${id}.jpg`;
    const blob = await compressPhoto(f);
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw new Error(`No se pudo subir ${f.name}: ${up.error.message}`);
    const ins = await sb.from("photos").insert({
      id, project_id: projectId, category, path_original: path, taken_at: new Date(f.lastModified).toISOString(),
    });
    if (ins.error) {
      await sb.storage.from(BUCKET).remove([path]); // sin fila no hay quien limpie el archivo
      throw new Error(`No se pudo guardar ${f.name}: ${ins.error.message}`);
    }
    onProgress?.(++hechas);
  }
  return hechas;
}
