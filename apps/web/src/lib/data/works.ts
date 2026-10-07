import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { inferKind, type ParsedWork } from "@/lib/alcance-parser";
import { cached, isNetworkError } from "@/lib/offline/cache";
import { changed, must, ok } from "./util";

export const stages = ["construccion", "perforacion", "complementarias", "operacion", "abandono"] as const;
export type Stage = (typeof stages)[number];
/** Etiqueta de una etapa conocida; una cargada a mano se muestra tal cual. */
export const stageText = (s: string): string => stageLabel[s as Stage] ?? s;
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
  kind: z.string(), // conocido (workKinds) o cargado a mano (0029)
  name: z.string(),
  code: z.string().nullable(),
  stage: z.string().nullable(),
  sort_order: z.number(),
  declared_length_m: num,
  declared_area_m2: num,
  diameter_in: num,
  material: z.string().nullable(),
  description: z.string().nullable(),
  geom_length_m: num,
  geom_area_m2: num,
  // obras iguales declaradas juntas (0026); default para copias offline guardadas antes de la columna
  quantity: z.number().int().min(1).default(1),
});
export type WorkRow = z.infer<typeof workRowSchema>;
export type WorkPatch = Partial<
  Pick<
    WorkRow,
    | "kind" | "name" | "code" | "stage" | "sort_order" | "declared_length_m" | "declared_area_m2"
    | "diameter_in" | "material" | "description" | "quantity"
  >
>;

const COLS =
  "id, project_id, kind, name, code, stage, sort_order, declared_length_m, declared_area_m2, diameter_in, material, description, geom_length_m, geom_area_m2, quantity";

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

/** Obra nueva escrita a mano desde un desplegable (Capas, Relevamiento): tipo inferido del nombre, sin medidas. */
export async function createWork(projectId: string, name: string, sortOrder: number): Promise<string> {
  const res = await createClient()
    .from("works")
    .insert({ project_id: projectId, name, kind: inferKind(name), sort_order: sortOrder })
    .select("id")
    .single();
  return z.object({ id: z.string() }).parse(must(res)).id;
}

export async function addWorks(projectId: string, rows: ParsedWork[], startOrder: number) {
  const payload = rows.map((r, i) => ({
    project_id: projectId,
    kind: r.kind,
    name: r.name,
    declared_length_m: r.declared_length_m,
    declared_area_m2: r.declared_area_m2,
    diameter_in: r.diameter_in,
    quantity: r.quantity,
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
