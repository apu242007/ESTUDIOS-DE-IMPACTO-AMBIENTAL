import type { z } from "zod";
import { parseAll } from "@/lib/data/util";
import { getDb } from "./db";

/**
 * ¿El error es por falta de red (y no por permisos, datos inválidos, etc.)? Solo en ese caso conviene
 * mostrar la última copia guardada: ante cualquier otro error hay que mostrarlo, no taparlo con datos viejos.
 * PostgREST, sin red, devuelve "TypeError: Failed to fetch" (Chrome), "TypeError: Load failed" (Safari)
 * o "TypeError: NetworkError when attempting to fetch resource." (Firefox).
 */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
}

/**
 * Con conexión trae y guarda una copia en IndexedDB; si falla y `fallback(error)` lo permite, devuelve la
 * última copia. Sin copia, relanza el error.
 */
export async function cached<T>(
  key: string,
  schema: z.ZodType<T>,
  fetcher: () => Promise<unknown[]>,
  fallback: (e: unknown) => boolean = isNetworkError,
): Promise<T[]> {
  const db = getDb();
  // Sin red ni se intenta: cada consulta reintenta con espera (1 s, 2 s, 4 s) y la pantalla quedaba "Cargando…".
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const hit = await db.catalogs.get(key);
    if (hit) return parseAll(schema, hit.value as unknown[]);
    throw new Error("Sin señal y sin copia guardada en este teléfono.");
  }
  try {
    const rows = parseAll(schema, await fetcher());
    await db.catalogs.put({ key, value: rows, savedAt: Date.now() });
    return rows;
  } catch (e) {
    if (!fallback(e)) throw e;
    const hit = await db.catalogs.get(key);
    if (hit) return parseAll(schema, hit.value as unknown[]);
    throw e;
  }
}
