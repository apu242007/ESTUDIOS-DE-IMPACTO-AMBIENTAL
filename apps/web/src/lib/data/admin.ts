import { createClient } from "@/lib/supabase/client";
import {
  codeRowSchema,
  memberRowSchema,
  type CodeRow,
  type MemberRow,
  type Role,
} from "@/lib/schemas";
import { must, ok, parseAll } from "./util";

// ---------- Usuarios ----------
export async function listMembers(orgId: string): Promise<MemberRow[]> {
  const res = await createClient().rpc("list_members", { p_org: orgId });
  return parseAll(memberRowSchema, must(res));
}

export async function addMember(orgId: string, email: string, role: Role): Promise<void> {
  ok(await createClient().rpc("add_member_by_email", { p_org: orgId, p_email: email, p_role: role }));
}

export async function changeRole(orgId: string, userId: string, role: Role): Promise<void> {
  ok(
    await createClient()
      .from("memberships")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", userId),
  );
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  ok(await createClient().from("memberships").delete().eq("org_id", orgId).eq("user_id", userId));
}

export async function createOrganization(name: string): Promise<string> {
  const res = await createClient().rpc("create_organization", { p_name: name });
  return String(must(res));
}

// ---------- Catálogo de siglas ----------
export async function listCodes(orgId: string): Promise<CodeRow[]> {
  const res = await createClient()
    .from("catalog_codes")
    .select("id, code, meaning, sort_order")
    .eq("org_id", orgId)
    .order("sort_order")
    .order("code");
  return parseAll(codeRowSchema, must(res));
}

export async function addCode(orgId: string, code: string, meaning: string, sort: number) {
  ok(
    await createClient()
      .from("catalog_codes")
      .insert({ org_id: orgId, code: code.trim(), meaning: meaning.trim(), sort_order: sort }),
  );
}

export async function updateCode(id: string, meaning: string) {
  ok(await createClient().from("catalog_codes").update({ meaning: meaning.trim() }).eq("id", id));
}

export async function deleteCode(id: string) {
  ok(await createClient().from("catalog_codes").delete().eq("id", id));
}
