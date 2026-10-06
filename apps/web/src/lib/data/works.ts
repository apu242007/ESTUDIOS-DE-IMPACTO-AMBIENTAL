import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { workKinds, type ParsedWork } from "@/lib/alcance-parser";
import { cached, isNetworkError } from "@/lib/offline/cache";
import { changed, must, ok } from "./util";

export const stages = ["construccion", "perforacion", "complementarias", "operacion", "abandono"] as const;
export type Stage = (typeof stages)[number];
export const stageLabel: Record<Stage, string> = {
  construccion: "Construcción",
  perforacion: "Perforación",
  complementarias: "Complementarias",
  operacion: "Operación",
  abandono: "Abandono",
};

const num = z.number().nullable();
export const workRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  kind: z.enum(workKinds),
  name: z.string(),
  code: z.string().nullable(),
  stage: z.enum(stages).nullable(),
  sort_order: z.number(),
  declared_length_m: num,
  declared_area_m2: num,
  diameter_in: num,
  material: z.string().nullable(),
  description: z.string().nullable(),
  geom_length_m: num,
  geom_area_m2: num,
});
export type WorkRow = z.infer<typeof workRowSchema>;
export type WorkPatch = Partial<
  Pick<
    WorkRow,
    | "kind" | "name" | "code" | "stage" | "sort_order" | "declared_length_m" | "declared_area_m2"
    | "diameter_in" | "material" | "description"
  >
>;

const COLS =
  "id, project_id, kind, name, code, stage, sort_order, declared_length_m, declared_area_m2, diameter_in, material, description, geom_length_m, geom_area_m2";

/** Con copia en el teléfono (solo se usa sin red): la ficha de campo ofrece las obras aunque no haya señal. */
export async function listWorks(projectId: string): Promise<WorkRow[]> {
  return cached(`works:${projectId}`, workRowSchema, async () =>
    must(
      await createClient()
        .from("works")
        .select(COLS)
        .eq("project_id", projectId)
        .order("sort_order")
        .order("created_at"),
    ),
    isNetworkError,
  );
}

export async function addWorks(projectId: string, rows: ParsedWork[], startOrder: number) {
  const payload = rows.map((r, i) => ({
    project_id: projectId,
    kind: r.kind,
    name: r.name,
    declared_length_m: r.declared_length_m,
    declared_area_m2: r.declared_area_m2,
    diameter_in: r.diameter_in,
    sort_order: startOrder + i + 1,
  }));
  ok(await createClient().from("works").insert(payload));
}

export async function updateWork(id: string, patch: WorkPatch) {
  changed(await createClient().from("works").update(patch).eq("id", id).select("id"));
}

export async function deleteWork(id: string) {
  changed(await createClient().from("works").delete().eq("id", id).select("id"));
}
