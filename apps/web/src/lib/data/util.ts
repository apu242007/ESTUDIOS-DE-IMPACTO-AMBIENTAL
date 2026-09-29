import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodType } from "zod";

type Res<T> = { data: T | null; error: PostgrestError | null };

/** Devuelve `data` o lanza con el mensaje de Supabase. */
export function must<T>(res: Res<T>): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("Sin datos");
  return res.data;
}

export function ok(res: { error: PostgrestError | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Para update/delete con .select("id"): falla si RLS filtró la fila y no cambió nada. */
export function changed(res: { data: unknown[] | null; error: PostgrestError | null }): void {
  if (res.error) throw new Error(res.error.message);
  if (!res.data || res.data.length === 0) {
    throw new Error("No se aplicó el cambio: no existe o no tenés permisos.");
  }
}

export function parseAll<T>(schema: ZodType<T>, rows: unknown[]): T[] {
  return rows.map((r) => schema.parse(r));
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Error inesperado";
}
