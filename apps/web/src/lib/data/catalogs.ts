import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { getDb } from "@/lib/offline/db";
import { must, parseAll } from "./util";

export const codeSchema = z.object({ code: z.string(), meaning: z.string() });
export const photoCategorySchema = z.object({ key: z.string(), label: z.string() });
export type CatalogCode = z.infer<typeof codeSchema>;
export type PhotoCategory = z.infer<typeof photoCategorySchema>;

/** Con conexión trae y guarda en IndexedDB; sin conexión (o si falla) usa la última copia. */
async function cached<T>(key: string, schema: z.ZodType<T>, fetcher: () => Promise<unknown[]>): Promise<T[]> {
  const db = getDb();
  try {
    const rows = parseAll(schema, await fetcher());
    await db.catalogs.put({ key, value: rows, savedAt: Date.now() });
    return rows;
  } catch (e) {
    const hit = await db.catalogs.get(key);
    if (hit) return parseAll(schema, hit.value as unknown[]);
    throw e;
  }
}

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
