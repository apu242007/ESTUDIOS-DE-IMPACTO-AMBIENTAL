import { createClient } from "@/lib/supabase/client";

/** Últimas señales del worker (worker_heartbeat, 0023): la PC ('main') y GitHub Actions ('actions'); null si nunca. */
export async function getWorkerSeen(): Promise<{ pc: string | null; nube: string | null }> {
  const { data, error } = await createClient().from("worker_heartbeat").select("id, seen_at");
  if (error) throw new Error(error.message);
  const de = (id: string) => ((data ?? []).find((r) => r.id === id)?.seen_at as string | undefined) ?? null;
  return { pc: de("main"), nube: de("actions") };
}
