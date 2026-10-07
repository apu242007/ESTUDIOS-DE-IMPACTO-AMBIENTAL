import { createClient } from "@/lib/supabase/client";
import {
  cadastreRowSchema,
  emptyToNull,
  normalizeCuit,
  projectRowSchema,
  type CadastreRow,
  type ProjectFormValues,
  type ProjectRow,
} from "@/lib/schemas";
import { DEFAULT_THRESHOLDS } from "@/lib/threshold";
import { cached } from "@/lib/offline/cache";
import { changed, must, ok, parseAll } from "./util";

// Lista y ficha del proyecto guardan copia en el teléfono: sin señal, en el campo, se puede abrir el proyecto
// y seguir con el relevamiento. La copia se usa SOLO si falta la red; cualquier otro error se muestra.
export async function listProjects(orgId: string): Promise<ProjectRow[]> {
  return cached(`projects:${orgId}`, projectRowSchema, async () =>
    must(
      await createClient()
        .from("projects")
        .select("*, clients(name)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
    ),
  );
}

export async function resetThresholds(projectId: string): Promise<void> {
  const res = await createClient()
    .from("projects")
    .update({ thresholds: DEFAULT_THRESHOLDS })
    .eq("id", projectId)
    .select("id");
  changed(res);
}

/** Pasos del recorrido que un admin da por cumplidos (la base rechaza el cambio si no es admin, 0021). */
export async function setSkippedSteps(projectId: string, steps: string[]): Promise<void> {
  const res = await createClient().from("projects").update({ skipped_steps: steps }).eq("id", projectId).select("id");
  changed(res);
}

export async function getProject(id: string): Promise<ProjectRow> {
  const [row] = await cached(`project:${id}`, projectRowSchema, async () =>
    [must(await createClient().from("projects").select("*, clients(name)").eq("id", id).single())],
  );
  return row;
}

function toRow(v: ProjectFormValues) {
  const cuit = emptyToNull(v.applicant_cuit);
  return {
    client_id: v.client_id,
    name: v.name.trim(),
    code: emptyToNull(v.code),
    short_name: emptyToNull(v.short_name),
    doc_type: v.doc_type,
    field_area: emptyToNull(v.field_area),
    report_date: emptyToNull(v.report_date ?? ""),
    province: v.province,
    applicant: {
      razon_social: emptyToNull(v.applicant_razon_social) ?? undefined,
      cuit: cuit ? normalizeCuit(cuit) : undefined,
      domicilio: emptyToNull(v.applicant_domicilio) ?? undefined,
    },
    consultant: {
      razon_social: emptyToNull(v.consultant_razon_social) ?? undefined,
      responsable: emptyToNull(v.consultant_responsable) ?? undefined,
      matricula: emptyToNull(v.consultant_matricula) ?? undefined,
    },
  };
}

export async function saveProject(
  orgId: string,
  id: string | null,
  v: ProjectFormValues,
): Promise<string> {
  const supabase = createClient();
  if (id) {
    changed(await supabase.from("projects").update(toRow(v)).eq("id", id).select("id"));
    return id;
  }
  const res = await supabase
    .from("projects")
    .insert({ ...toRow(v), org_id: orgId })
    .select("id")
    .single();
  return projectRowSchema.pick({ id: true }).parse(must(res)).id;
}

/** Copia el proyecto y sus obras (no fotos ni relevamiento) en una sola transacción de base. */
export async function duplicateProject(projectId: string): Promise<string> {
  const res = await createClient().rpc("duplicate_project", { p_src: projectId });
  return String(must(res));
}

// ---------- Catastro (solo admin, lo fuerza la RLS) ----------
export async function listCadastre(projectId: string): Promise<CadastreRow[]> {
  const res = await createClient()
    .from("cadastre_data")
    .select("id, project_id, nomenclature, lot, owners")
    .eq("project_id", projectId)
    .order("created_at");
  return parseAll(cadastreRowSchema, must(res));
}

export async function addCadastre(
  projectId: string,
  v: { nomenclature?: string; lot?: string; owners?: string },
): Promise<void> {
  ok(
    await createClient()
      .from("cadastre_data")
      .insert({
        project_id: projectId,
        nomenclature: emptyToNull(v.nomenclature),
        lot: emptyToNull(v.lot),
        owners: emptyToNull(v.owners),
      }),
  );
}

export async function deleteCadastre(id: string): Promise<void> {
  changed(await createClient().from("cadastre_data").delete().eq("id", id).select("id"));
}
