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
import { must, ok, parseAll } from "./util";

export async function listProjects(orgId: string): Promise<ProjectRow[]> {
  const res = await createClient()
    .from("projects")
    .select("*, clients(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return parseAll(projectRowSchema, must(res));
}

export async function getProject(id: string): Promise<ProjectRow> {
  const res = await createClient().from("projects").select("*, clients(name)").eq("id", id).single();
  return projectRowSchema.parse(must(res));
}

function toRow(v: ProjectFormValues) {
  const cuit = emptyToNull(v.applicant_cuit);
  return {
    client_id: v.client_id,
    name: v.name.trim(),
    code: emptyToNull(v.code),
    doc_type: v.doc_type,
    field_area: emptyToNull(v.field_area),
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
    ok(await supabase.from("projects").update(toRow(v)).eq("id", id));
    return id;
  }
  const res = await supabase
    .from("projects")
    .insert({ ...toRow(v), org_id: orgId })
    .select("id")
    .single();
  return projectRowSchema.pick({ id: true }).parse(must(res)).id;
}

/** Copia el proyecto y sus obras (no fotos ni relevamiento). */
export async function duplicateProject(projectId: string): Promise<string> {
  const supabase = createClient();
  const src = await getProject(projectId);
  const created = await supabase
    .from("projects")
    .insert({
      org_id: src.org_id,
      client_id: src.client_id,
      name: `${src.name} (copia)`,
      code: src.code,
      doc_type: src.doc_type,
      field_area: src.field_area,
      province: src.province,
      applicant: src.applicant,
      consultant: src.consultant,
      crs_epsg: src.crs_epsg,
      thresholds: src.thresholds,
      status: "borrador",
    })
    .select("id")
    .single();
  const newId = projectRowSchema.pick({ id: true }).parse(must(created)).id;

  const worksRes = await supabase.from("works").select("*").eq("project_id", projectId);
  const works = must(worksRes) as Record<string, unknown>[];
  if (works.length > 0) {
    const copies = works.map((w) => {
      // se descartan id, org_id y medidas calculadas: las regenera la base
      const rest = { ...w };
      for (const k of ["id", "org_id", "created_at", "geom_length_m", "geom_area_m2"]) delete rest[k];
      return { ...rest, project_id: newId };
    });
    ok(await supabase.from("works").insert(copies));
  }
  return newId;
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
  ok(await createClient().from("cadastre_data").delete().eq("id", id));
}
