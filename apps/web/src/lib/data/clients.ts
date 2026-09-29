import { createClient } from "@/lib/supabase/client";
import {
  clientRowSchema,
  emptyToNull,
  normalizeCuit,
  type ClientFormValues,
  type ClientRow,
} from "@/lib/schemas";
import { must, ok, parseAll } from "./util";

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
  if (id) {
    ok(await supabase.from("clients").update(base).eq("id", id));
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
    ok(await supabase.from("clients").update({ logo_path: path }).eq("id", clientId));
  }
  return clientId as string;
}

export async function deleteClient(id: string): Promise<void> {
  // projects.client_id es ON DELETE RESTRICT: si tiene proyectos, falla con mensaje de FK
  const res = await createClient().from("clients").delete().eq("id", id);
  if (res.error) {
    throw new Error(
      res.error.code === "23503"
        ? "No se puede eliminar: el cliente tiene proyectos."
        : res.error.message,
    );
  }
}

export async function signedLogoUrl(path: string): Promise<string | null> {
  const res = await createClient().storage.from("project-files").createSignedUrl(path, 300);
  return res.data?.signedUrl ?? null;
}
