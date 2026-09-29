"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/proyectos" className="text-xl font-bold tracking-tight">
            EIA
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Principal">
            {NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path.startsWith(n.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-medium hover:bg-muted",
                  path.startsWith(n.href) && "bg-muted",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          {memberships.length > 1 && (
            <NativeSelect
              aria-label="Organización"
              className="w-auto max-w-56"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.org_name}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
