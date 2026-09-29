"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { membershipRowSchema, type Role } from "@/lib/schemas";
import { parseAll } from "@/lib/data/util";

export interface Membership {
  org_id: string;
  role: Role;
  org_name: string;
}

interface AuthState {
  session: Session | null;
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
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);

  const refreshMemberships = useCallback(async (): Promise<Membership[]> => {
    const { data, error } = await supabase
      .from("memberships")
      .select("org_id, role, organizations(name)");
    if (error) throw new Error(error.message);
    const list = parseAll(membershipRowSchema, data ?? []).map((m) => ({
      org_id: m.org_id,
      role: m.role,
      org_name: m.organizations?.name ?? "(sin nombre)",
    }));
    setMemberships(list);
    setOrgIdState((cur) => {
      const wanted = cur ?? readStoredOrg();
      return list.find((m) => m.org_id === wanted)?.org_id ?? list[0]?.org_id ?? null;
    });
    return list;
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    const load = async (s: Session | null) => {
      if (!alive) return;
      setSession(s);
      if (s) {
        try {
          await refreshMemberships();
        } catch {
          setMemberships([]);
        }
      } else {
        setMemberships([]);
        setOrgIdState(null);
      }
      if (alive) setLoading(false);
    };
    void supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      // diferido: no llamar a supabase dentro del callback de auth
      setTimeout(() => void load(s), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, refreshMemberships]);

  const setOrgId = useCallback((id: string) => {
    setOrgIdState(id);
    try {
      localStorage.setItem(ORG_KEY, id);
    } catch {
      /* sin storage: solo pierde la preferencia */
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const role = memberships.find((m) => m.org_id === orgId)?.role ?? null;
  const value: AuthState = {
    session,
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
