import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { changed, must, ok, parseAll } from "./util";

export const textBlockSchema = z.object({
  key: z.string(),
  scope: z.string(),
  title: z.string().nullable(),
  template: z.string(),
  sort_order: z.number(),
});
export type TextBlock = z.infer<typeof textBlockSchema>;

export async function listTextBlocks(orgId: string, scope: "declaracion" | "seccion"): Promise<TextBlock[]> {
  const res = await createClient()
    .from("catalog_text_blocks")
    .select("key, scope, title, template, sort_order")
    .eq("org_id", orgId)
    .eq("scope", scope)
    .order("sort_order");
  return parseAll(textBlockSchema, must(res));
}

// ---- declaraciones editadas por proyecto (una por factor)
const declSchema = z.object({ factor_id: z.string(), body_override: z.string() });

export async function listDeclarationOverrides(projectId: string): Promise<Map<string, string>> {
  const res = await createClient().from("project_declarations").select("factor_id, body_override").eq("project_id", projectId);
  return new Map(parseAll(declSchema, must(res)).map((r) => [r.factor_id, r.body_override]));
}

export async function saveDeclaration(projectId: string, factorId: string, body: string | null) {
  const sb = createClient();
  if (body === null) {
    ok(await sb.from("project_declarations").delete().eq("project_id", projectId).eq("factor_id", factorId));
    return;
  }
  ok(await sb.from("project_declarations").upsert({ project_id: projectId, factor_id: factorId, body_override: body }, { onConflict: "project_id,factor_id" }));
}

// ---- secciones narrativas editadas por proyecto
const secSchema = z.object({ key: z.string(), body: z.string() });

export async function listSectionOverrides(projectId: string): Promise<Map<string, string>> {
  const res = await createClient().from("project_section_texts").select("key, body").eq("project_id", projectId);
  return new Map(parseAll(secSchema, must(res)).map((r) => [r.key, r.body]));
}

export async function saveSectionText(projectId: string, key: string, body: string | null) {
  const sb = createClient();
  if (body === null) {
    ok(await sb.from("project_section_texts").delete().eq("project_id", projectId).eq("key", key));
    return;
  }
  ok(await sb.from("project_section_texts").upsert({ project_id: projectId, key, body }, { onConflict: "project_id,key" }));
}

// ---- ambiente por zona
const envSchema = z.object({
  id: z.string(),
  zone_key: z.string(),
  section: z.string(),
  label: z.string(),
  body: z.string(),
  sort_order: z.number(),
});
export type EnvItem = z.infer<typeof envSchema>;

export async function listEnvironment(orgId: string): Promise<EnvItem[]> {
  const res = await createClient()
    .from("catalog_environment")
    .select("id, zone_key, section, label, body, sort_order")
    .eq("org_id", orgId)
    .order("sort_order");
  return parseAll(envSchema, must(res));
}

const penvSchema = z.object({ item_id: z.string(), included: z.boolean(), body_override: z.string().nullable() });
export type ProjectEnvRow = z.infer<typeof penvSchema>;

export async function listProjectEnvironment(projectId: string): Promise<Map<string, ProjectEnvRow>> {
  const res = await createClient().from("project_environment").select("item_id, included, body_override").eq("project_id", projectId);
  return new Map(parseAll(penvSchema, must(res)).map((r) => [r.item_id, r]));
}

/** Sin fila = incluido (todo se carga tildado). Solo se guarda lo que el profesional cambia. */
export async function saveEnvItem(projectId: string, itemId: string, patch: { included?: boolean; body_override?: string | null }) {
  ok(await createClient().from("project_environment").upsert({ project_id: projectId, item_id: itemId, ...patch }, { onConflict: "project_id,item_id" }));
}

export async function setZone(projectId: string, zoneKey: string | null) {
  changed(await createClient().from("projects").update({ zone_key: zoneKey }).eq("id", projectId).select("id"));
}
