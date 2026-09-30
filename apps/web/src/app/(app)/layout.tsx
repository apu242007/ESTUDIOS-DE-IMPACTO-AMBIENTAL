"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/proyectos", label: "Proyectos" },
  { href: "/clientes", label: "Clientes" },
  { href: "/admin", label: "Administración", adminOnly: true },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, memberships, orgId, isAdmin, setOrgId, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (memberships.length === 0) router.replace("/onboarding");
  }, [loading, session, memberships.length, router]);

  if (loading || !session || !orgId) {
    return <main className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</main>;
  }

  const orgName = memberships.find((m) => m.org_id === orgId)?.org_name;

  return (
    <div className="min-h-screen bg-background">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 pt-2">
          <Link href="/proyectos" className="flex items-center gap-2 py-2 text-primary">
            <Mark className="size-8" />
            <span className="font-heading text-xl font-semibold tracking-tight text-foreground">EIA</span>
          </Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1" aria-label="Principal">
            {NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin).map((n) => {
              const active = path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center whitespace-nowrap border-b-4 px-3 text-base font-medium transition-colors",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 py-2">
            {memberships.length > 1 ? (
              <NativeSelect aria-label="Organización" className="w-auto max-w-56" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {memberships.map((m) => (
                  <option key={m.org_id} value={m.org_id}>{m.org_name}</option>
                ))}
              </NativeSelect>
            ) : (
              orgName && <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">{orgName}</span>
            )}
            <Button variant="outline" onClick={() => void signOut()}>Salir</Button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
