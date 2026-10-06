import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { cached } from "@/lib/offline/cache";
import { must } from "./util";

export const codeSchema = z.object({ code: z.string(), meaning: z.string() });
export const photoCategorySchema = z.object({ key: z.string(), label: z.string() });
export type CatalogCode = z.infer<typeof codeSchema>;
export type PhotoCategory = z.infer<typeof photoCategorySchema>;

export const listCodes = (orgId: string) =>
  cached(`codes:${orgId}`, codeSchema, async () =>
    must(await createClient().from("catalog_codes").select("code, meaning").eq("org_id", orgId).order("sort_order")),
  );

export const listPhotoCategories = (orgId: string) =>
  cached(`photocats:${orgId}`, photoCategorySchema, async () =>
    must(
      await createClient().from("catalog_photo_categories").select("key, label").eq("org_id", orgId).order("sort_order"),
    ),
  );

/** Clave estable a partir del nombre visible: "Cruce de ductos" → "cruce_de_ductos". */
export function slugKey(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Alta rápida desde el desplegable (solo admins, por RLS). Devuelve la clave creada. */
export async function addPhotoCategory(orgId: string, label: string, sort: number): Promise<string> {
  const key = slugKey(label);
  if (!key) throw new Error("El nombre tiene que tener letras o números.");
  must(
    await createClient()
      .from("catalog_photo_categories")
      .insert({ org_id: orgId, key, label: label.trim(), sort_order: sort })
      .select("key")
      .single(),
  );
  return key;
}
