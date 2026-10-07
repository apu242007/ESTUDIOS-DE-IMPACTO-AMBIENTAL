import { createClient } from "@/lib/supabase/client";

/** Última señal del worker (worker_heartbeat, 0023); null si nunca latió. */
export async function getWorkerSeen(): Promise<string | null> {
  const { data, error } = await createClient().from("worker_heartbeat").select("seen_at").eq("id", "main").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.seen_at as string | undefined) ?? null;
}
