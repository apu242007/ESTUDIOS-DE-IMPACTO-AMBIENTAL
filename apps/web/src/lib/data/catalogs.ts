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
