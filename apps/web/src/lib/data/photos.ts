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
