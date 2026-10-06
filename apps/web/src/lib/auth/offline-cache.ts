import { z } from "zod";
import { roleSchema } from "@/lib/schemas";

/**
 * Identidad guardada en el teléfono para abrir la app sin señal cuando la sesión ya venció y no se puede
 * renovar (pasa al rato de estar en el campo). No es una credencial: no da acceso a nada del servidor (la RLS
 * sigue mandando y al volver la señal Supabase renueva la sesión); solo permite abrir lo que ya está en este
 * dispositivo: las fichas en IndexedDB y la última copia de los proyectos. Se borra al salir.
 */
const authCacheSchema = z.object({
  userId: z.string(),
  memberships: z.array(z.object({ org_id: z.string(), role: roleSchema, org_name: z.string() })),
});
export type AuthCache = z.infer<typeof authCacheSchema>;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "eia.auth";
const local = (): Store | undefined => (typeof localStorage === "undefined" ? undefined : localStorage);

export function readAuthCache(store: Store | undefined = local()): AuthCache | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed = authCacheSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeAuthCache(value: AuthCache | null, store: Store | undefined = local()): void {
  try {
    if (value) store?.setItem(KEY, JSON.stringify(value));
    else store?.removeItem(KEY);
  } catch {
    /* sin storage: solo se pierde el modo sin conexión */
  }
}

/** Sin sesión: se entra "sin conexión" solo si falta la red, hay identidad guardada y no fue un cierre de sesión. */
export function offlineIdentity(cache: AuthCache | null, networkDown: boolean, signedOut: boolean): AuthCache | null {
  return cache && networkDown && !signedOut && cache.memberships.length > 0 ? cache : null;
}
