"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isAuthRetryableFetchError, type AuthChangeEvent, type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { membershipRowSchema, type Role } from "@/lib/schemas";
import { parseAll } from "@/lib/data/util";
import { isNetworkError } from "@/lib/offline/cache";
import { offlineIdentity, readAuthCache, writeAuthCache } from "./offline-cache";

export interface Membership {
  org_id: string;
  role: Role;
  org_name: string;
}

interface AuthState {
  session: Session | null;
  /** Sin señal y sin sesión vigente: se trabaja con la identidad guardada, solo con datos del teléfono. */
  offline: boolean;
  loading: boolean;
  memberships: Membership[];
  orgId: string | null;
  role: Role | null;
  isAdmin: boolean;
  setOrgId: (id: string) => void;
  refreshMemberships: () => Promise<Membership[]>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const ORG_KEY = "eia.orgId";

function readStoredOrg(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  // la última lectura de la sesión falló por red (token vencido que no se pudo renovar sin señal)
  const netDown = useRef(false);

  const applyMemberships = useCallback((list: Membership[]) => {
    setMemberships(list);
    setOrgIdState((cur) => {
      const wanted = cur ?? readStoredOrg();
      return list.find((m) => m.org_id === wanted)?.org_id ?? list[0]?.org_id ?? null;
    });
  }, []);

  /** El id sale de la sesión local, no de `getUser()`: sin señal `getUser()` no responde y parecía "sin organización". */
  const fetchMemberships = useCallback(
    async (uid: string): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("org_id, role, organizations(name)")
        .eq("user_id", uid);
      if (error) throw new Error(error.message);
      const list = parseAll(membershipRowSchema, data ?? []).map((m) => ({
        org_id: m.org_id,
        role: m.role,
        org_name: m.organizations?.name ?? "(sin nombre)",
      }));
      writeAuthCache({ userId: uid, memberships: list });
      return list;
    },
    [supabase],
  );

  const refreshMemberships = useCallback(async (): Promise<Membership[]> => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return [];
    const list = await fetchMemberships(uid);
    applyMemberships(list);
    return list;
  }, [supabase, fetchMemberships, applyMemberships]);

  useEffect(() => {
    let alive = true;
    let gen = 0; // solo la carga más reciente puede dejar el estado final
    const load = async (s: Session | null, evt?: AuthChangeEvent) => {
      const mine = ++gen;
      if (!alive) return;
      // Con sesión nueva (login) las membresías aún no llegaron: sin esto las pantallas ven "sesión sin
      // organización" y mandan a crear una, generando organizaciones duplicadas.
      if (s) setLoading(true);
      setSession(s);
      if (s) {
        setOffline(false);
        try {
          const list = await fetchMemberships(s.user.id);
          if (mine === gen) applyMemberships(list);
        } catch (e) {
          // sin señal: la última lista guardada de este mismo usuario (antes quedaba vacía y mandaba a "Crear organización")
          const c = readAuthCache();
          if (mine === gen) applyMemberships(isNetworkError(e) && c?.userId === s.user.id ? c.memberships : []);
        }
      } else {
        if (evt === "SIGNED_OUT") writeAuthCache(null);
        const down = netDown.current || !navigator.onLine;
        const id = offlineIdentity(readAuthCache(), down, evt === "SIGNED_OUT");
        setOffline(!!id);
        if (id) applyMemberships(id.memberships);
        else {
          setMemberships([]);
          setOrgIdState(null);
        }
      }
      if (alive && mine === gen) setLoading(false);
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      netDown.current = isAuthRetryableFetchError(error);
      return load(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      // diferido: no llamar a supabase dentro del callback de auth
      setTimeout(() => void load(s, evt), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, fetchMemberships, applyMemberships]);

  const setOrgId = useCallback((id: string) => {
    setOrgIdState(id);
    try {
      localStorage.setItem(ORG_KEY, id);
    } catch {
      /* sin storage: solo pierde la preferencia */
    }
  }, []);

  const signOut = useCallback(async () => {
    writeAuthCache(null);
    await supabase.auth.signOut();
    // sin señal Supabase puede no emitir SIGNED_OUT: la pantalla sale igual
    setSession(null);
    setOffline(false);
    setMemberships([]);
    setOrgIdState(null);
  }, [supabase]);

  const role = memberships.find((m) => m.org_id === orgId)?.role ?? null;
  const value: AuthState = {
    session,
    offline,
    loading,
    memberships,
    orgId,
    role,
    isAdmin: role === "admin",
    setOrgId,
    refreshMemberships,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
