import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Measure, MeasureFactor } from "@/lib/pga";
import { must, ok, parseAll } from "./util";

const measureSchema = z.object({
  id: z.string(),
  general: z.boolean(),
  stage: z.string().nullable(),
  action: z.string().nullable(),
  resource: z.string().nullable(),
  timing: z.string().nullable(),
  responsible: z.string().nullable(),
  follow_up: z.string().nullable(),
  body: z.string(),
  sort_order: z.number(),
});

export async function listMeasures(orgId: string): Promise<Measure[]> {
  const res = await createClient()
    .from("catalog_measures")
    .select("id, general, stage, action, resource, timing, responsible, follow_up, body, sort_order")
    .eq("org_id", orgId)
    .order("sort_order")
    .limit(2000);
  return parseAll(measureSchema, must(res));
}

const linkSchema = z.object({ measure_id: z.string(), factor_id: z.string() });

export async function listMeasureLinks(orgId: string): Promise<MeasureFactor[]> {
  const res = await createClient().from("catalog_measure_factors").select("measure_id, factor_id").eq("org_id", orgId).limit(10000);
  return parseAll(linkSchema, must(res));
}

const selSchema = z.object({ measure_id: z.string(), selected: z.boolean(), responsible: z.string().nullable(), timing: z.string().nullable() });
export type Selection = z.infer<typeof selSchema>;

export async function listSelections(projectId: string): Promise<Map<string, Selection>> {
  const res = await createClient().from("project_measures").select("measure_id, selected, responsible, timing").eq("project_id", projectId).limit(5000);
  return new Map(parseAll(selSchema, must(res)).map((r) => [r.measure_id, r]));
}

/** Agrega medidas al PGA del proyecto (conserva responsable/momento de las que ya estaban). */
export async function addMeasures(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  ok(await createClient().from("project_measures").upsert(ids.map((measure_id) => ({ project_id: projectId, measure_id, selected: true })), { onConflict: "project_id,measure_id", ignoreDuplicates: true }));
}

export async function removeMeasures(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  ok(await createClient().from("project_measures").delete().eq("project_id", projectId).in("measure_id", ids));
}

export async function updateSelection(projectId: string, measureId: string, patch: { responsible?: string | null; timing?: string | null }) {
  ok(await createClient().from("project_measures").update(patch).eq("project_id", projectId).eq("measure_id", measureId));
}
