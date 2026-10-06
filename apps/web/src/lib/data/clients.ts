import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  clientRowSchema,
  emptyToNull,
  normalizeCuit,
  type ClientFormValues,
  type ClientRow,
} from "@/lib/schemas";
import { changed, must, parseAll } from "./util";

const LOGO_EXT = ["png", "jpg", "jpeg"] as const;

export async function listClients(orgId: string): Promise<ClientRow[]> {
  const res = await createClient()
    .from("clients")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  return parseAll(clientRowSchema, must(res));
}

function toRow(v: ClientFormValues) {
  const cuit = emptyToNull(v.cuit);
  return {
    name: v.name.trim(),
    cuit: cuit ? normalizeCuit(cuit) : null,
    address: emptyToNull(v.address),
    contact: {
      nombre: emptyToNull(v.contact_nombre) ?? undefined,
      email: emptyToNull(v.contact_email) ?? undefined,
      telefono: emptyToNull(v.contact_telefono) ?? undefined,
    },
  };
}

export async function saveClient(
  orgId: string,
  id: string | null,
  v: ClientFormValues,
  logo: File | null,
): Promise<string> {
  const supabase = createClient();
  const base = toRow(v);
  let clientId = id;
  let oldLogo: string | null = null;
  if (id) {
    // el filtro por org_id + .select("id") garantiza que la fila existe en ESTA organización
    const cur = await supabase.from("clients").select("id, logo_path").eq("id", id).eq("org_id", orgId).single();
    oldLogo = z.object({ logo_path: z.string().nullable() }).parse(must(cur)).logo_path;
    changed(await supabase.from("clients").update(base).eq("id", id).eq("org_id", orgId).select("id"));
  } else {
    const res = await supabase
      .from("clients")
      .insert({ ...base, org_id: orgId })
      .select("id")
      .single();
    clientId = clientRowSchema.pick({ id: true }).parse(must(res)).id;
  }
  if (logo && clientId) {
    const ext = logo.name.split(".").pop()?.toLowerCase() ?? "";
    if (!LOGO_EXT.includes(ext as (typeof LOGO_EXT)[number])) {
      throw new Error("El logo debe ser PNG o JPG");
    }
    const path = `${orgId}/logos/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("project-files").upload(path, logo, { upsert: false });
    if (up.error) throw new Error(up.error.message);
    const upd = await supabase.from("clients").update({ logo_path: path }).eq("id", clientId).select("id");
    if (upd.error || !upd.data || upd.data.length === 0) {
      await supabase.storage.from("project-files").remove([path]); // compensación: sin huérfanos
      throw new Error(upd.error?.message ?? "No se pudo guardar el logo");
    }
    if (oldLogo) await supabase.storage.from("project-files").remove([oldLogo]);
  }
  return clientId as string;
}

export async function deleteClient(id: string): Promise<void> {
  // projects.client_id es ON DELETE RESTRICT: si tiene proyectos, falla con mensaje de FK
  const res = await createClient().from("clients").delete().eq("id", id).select("id");
  if (res.error) {
    throw new Error(
      res.error.code === "23503"
        ? "No se puede eliminar: el cliente tiene proyectos."
        : res.error.message,
    );
  }
  changed(res);
}

export async function signedLogoUrl(path: string): Promise<string | null> {
  const res = await createClient().storage.from("project-files").createSignedUrl(path, 300);
  return res.data?.signedUrl ?? null;
}

/** Encabezado de la consultora (logo + contacto) que el informe pone arriba de cada página. */
export async function getOrgHeader(orgId: string): Promise<string | null> {
  const res = await createClient().from("organizations").select("header_image_path").eq("id", orgId).single();
  return z.object({ header_image_path: z.string().nullable() }).parse(must(res)).header_image_path;
}

/** Solo un admin puede (política org_update). Sube primero y recién después apunta la organización al archivo nuevo. */
export async function uploadOrgHeader(orgId: string, file: File): Promise<void> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!LOGO_EXT.includes(ext as (typeof LOGO_EXT)[number])) throw new Error("El encabezado debe ser PNG o JPG");
  const supabase = createClient();
  const old = await getOrgHeader(orgId);
  const path = `${orgId}/branding/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("project-files").upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  const upd = await supabase.from("organizations").update({ header_image_path: path }).eq("id", orgId).select("id");
  if (upd.error || !upd.data || upd.data.length === 0) {
    await supabase.storage.from("project-files").remove([path]);
    throw new Error(upd.error?.message ?? "No se pudo guardar el encabezado");
  }
  if (old) await supabase.storage.from("project-files").remove([old]);
}
