import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

export const EMAIL = process.env.EIA_EMAIL;
export const PASS = process.env.EIA_PASS;
export const hasCreds = !!EMAIL && !!PASS;

function envFile(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  return Object.fromEntries(
    raw.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}

/** Cliente de Supabase con la sesión del usuario de prueba (RLS: hace lo mismo que la app). */
export async function api(): Promise<SupabaseClient> {
  const env = envFile();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email: EMAIL!, password: PASS! });
  if (error) throw error;
  return sb;
}

export type TestProject = { id: string; orgId: string; clientId: string; cleanup: () => Promise<void> };

/** Crea un cliente y un proyecto de prueba en la primera organización del usuario, y los borra al terminar. */
export async function createTestProject(sb: SupabaseClient, name = "ZZ e2e proyecto"): Promise<TestProject> {
  const { data: m, error: e1 } = await sb.from("memberships").select("org_id").limit(1).single();
  if (e1) throw e1;
  const orgId = m.org_id as string;
  const { data: c, error: e2 } = await sb.from("clients").insert({ org_id: orgId, name: "ZZ e2e cliente" }).select("id").single();
  if (e2) throw e2;
  const { data: p, error: e3 } = await sb
    .from("projects")
    .insert({ org_id: orgId, client_id: c.id, name, short_name: "PAD 58", field_area: "Bajada del Palo Oeste" })
    .select("id")
    .single();
  if (e3) throw e3;
  return {
    id: p.id, orgId, clientId: c.id,
    cleanup: async () => {
      await sb.from("projects").delete().eq("id", p.id);
      await sb.from("clients").delete().eq("id", c.id);
    },
  };
}

export async function login(page: Page) {
  await page.goto("/login/", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Contraseña").fill(PASS!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForFunction(() => location.pathname.includes("proyectos"), null, { timeout: 60_000 });
}

export const seccion = (id: string, s: string) => `/proyecto/?id=${id}&s=${s}`;
