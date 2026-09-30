import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { ATTRS, type Attr, type Attrs, type Sign } from "@/lib/impacts";
import { changed, must, ok, parseAll } from "./util";

const num = z.number().nullable();

export const stageOrder = ["construccion", "perforacion", "complementarias", "operacion", "abandono"] as const;
export type StageKey = (typeof stageOrder)[number];
export const stageName: Record<StageKey, string> = {
  construccion: "Construcción",
  perforacion: "Perforación y terminación",
  complementarias: "Obras complementarias",
  operacion: "Operación",
  abandono: "Abandono",
};

export const actionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  stage: z.string().nullable(),
  sort_order: z.number(),
});
export const factorSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  medio: z.string(),
  uip: num,
  component: z.string().nullable(),
  sort_order: z.number(),
});
export const attrOptionSchema = z.object({ attr: z.string(), label: z.string(), value: z.number(), sort_order: z.number() });
export const categorySchema = z.object({
  label: z.string(),
  min_abs: z.number(),
  max_abs: num,
  applies_to: z.enum(["negativo", "positivo"]),
});
export type ActionRow = z.infer<typeof actionSchema>;
export type FactorRow = z.infer<typeof factorSchema>;
export type AttrOption = z.infer<typeof attrOptionSchema>;

export type ImpactCatalog = {
  actions: ActionRow[];
  factors: FactorRow[];
  options: Record<Attr, AttrOption[]>;
  categories: z.infer<typeof categorySchema>[];
};

export async function loadImpactCatalog(orgId: string): Promise<ImpactCatalog> {
  const sb = createClient();
  const [a, f, o, c] = await Promise.all([
    sb.from("catalog_impact_actions").select("id, code, name, stage, sort_order").eq("org_id", orgId).order("sort_order"),
    sb.from("catalog_impact_factors").select("id, code, name, medio, uip, component, sort_order").eq("org_id", orgId).order("sort_order"),
    sb.from("catalog_impact_attrs").select("attr, label, value, sort_order").eq("org_id", orgId).order("sort_order"),
    sb.from("catalog_impact_categories").select("label, min_abs, max_abs, applies_to").eq("org_id", orgId).order("sort_order"),
  ]);
  const options = Object.fromEntries(ATTRS.map((k) => [k, [] as AttrOption[]])) as Record<Attr, AttrOption[]>;
  for (const opt of parseAll(attrOptionSchema, must(o))) {
    if ((ATTRS as readonly string[]).includes(opt.attr)) options[opt.attr as Attr].push(opt);
  }
  return {
    actions: parseAll(actionSchema, must(a)),
    factors: parseAll(factorSchema, must(f)),
    options,
    categories: parseAll(categorySchema, must(c)),
  };
}

export const impactSchema = z.object({
  id: z.string(),
  action_id: z.string(),
  factor_id: z.string(),
  sign: z.number(),
  attrs: z.record(z.string(), z.number()),
  importance: num,
  category: z.string().nullable(),
});
export type ImpactRow = z.infer<typeof impactSchema>;

export async function listImpacts(projectId: string): Promise<ImpactRow[]> {
  const res = await createClient()
    .from("project_impacts")
    .select("id, action_id, factor_id, sign, attrs, importance, category")
    .eq("project_id", projectId)
    .limit(5000);
  return parseAll(impactSchema, must(res));
}

export type ImpactInput = { action_id: string; factor_id: string; sign: Sign; attrs: Attrs };

/** Alta o edición de varias celdas. La importancia y la categoría las calcula la base (nadie las escribe a mano). */
export async function saveImpacts(projectId: string, rows: ImpactInput[]) {
  if (rows.length === 0) return;
  ok(
    await createClient()
      .from("project_impacts")
      .upsert(rows.map((r) => ({ project_id: projectId, ...r })), { onConflict: "project_id,action_id,factor_id" }),
  );
}

/** Copia la matriz de otro proyecto de la misma organización (pisa las celdas que ya existan). Devuelve cuántas copió. */
export async function copyImpacts(fromProject: string, toProject: string): Promise<number> {
  const res = await createClient().rpc("copy_project_impacts", { p_from: fromProject, p_to: toProject });
  return z.number().parse(must(res));
}

export async function deleteImpacts(ids: string[]) {
  if (ids.length === 0) return;
  changed(await createClient().from("project_impacts").delete().in("id", ids).select("id"));
}
