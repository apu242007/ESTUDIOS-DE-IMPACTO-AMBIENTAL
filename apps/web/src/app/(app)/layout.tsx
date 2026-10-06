"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, FolderOpen, LogOut, Settings2, UploadCloud, Users } from "lucide-react";
import { Mark } from "@/components/brand";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/offline/db";
import { useOnline } from "@/lib/offline/use-online";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/proyectos", label: "Proyectos", icon: FolderOpen },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/admin", label: "Administración", icon: Settings2, adminOnly: true },
] as const;

// "/proyecto/?id=…" (un proyecto abierto) también cuenta como estar en Proyectos
const isActive = (path: string, href: string) =>
  href === "/proyectos" ? path.startsWith("/proyecto") : path.startsWith(href);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, offline, loading, memberships, orgId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session && !offline) router.replace("/login");
    else if (memberships.length === 0) router.replace("/onboarding");
  }, [loading, session, offline, memberships.length, router]);

  if (loading || (!session && !offline) || !orgId) {
    return <main className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</main>;
  }
  // El cascarón lee IndexedDB: se monta solo en el navegador y con usuario, nunca en el prerender.
  return <Shell orgId={orgId}>{children}</Shell>;
}

/** Señal y cambios sin subir, siempre a la vista: en el campo es lo primero que hay que saber. */
function EstadoCampo({ online, pending, className }: { online: boolean; pending: number; className?: string }) {
  if (online && pending === 0) return null;
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-2 text-sm font-semibold", className)}>
      {!online && (
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-jarilla px-2.5 text-basalto">
          <CloudOff aria-hidden="true" className="size-4" />
          Sin señal
        </span>
      )}
      {pending > 0 && (
        <span className="tnum inline-flex min-h-8 items-center gap-1.5 rounded-md border border-sidebar-border px-2.5 text-sidebar-foreground">
          <UploadCloud aria-hidden="true" className="size-4" />
          {pending} sin subir
        </span>
      )}
    </div>
  );
}

function Shell({ orgId, children }: { orgId: string; children: React.ReactNode }) {
  const { memberships, isAdmin, setOrgId, signOut } = useAuth();
  const path = usePathname();
  const online = useOnline();
  const pending = useLiveQuery(() => getDb().outbox.count(), []) ?? 0;

  // Salir sin señal deja al profesional afuera hasta volver a tener conexión: se pide confirmación.
  const salir = () => {
    const avisos = [
      pending > 0 ? `Hay ${pending} cambios del relevamiento sin subir. Quedan guardados en este teléfono.` : null,
      !online ? "Sin señal no vas a poder volver a ingresar hasta tener conexión." : null,
    ].filter((a): a is string => a !== null);
    if (avisos.length > 0 && !window.confirm(["¿Salir de la cuenta?", ...avisos].join("\n\n"))) return;
    void signOut();
  };

  const orgName = memberships.find((m) => m.org_id === orgId)?.org_name;
  const items = NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin);
  const orgPicker =
    memberships.length > 1 ? (
      <NativeSelect aria-label="Organización" className="w-full border-sidebar-border bg-sidebar-accent px-2 text-sm text-sidebar-foreground" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
        {memberships.map((m) => (
          <option key={m.org_id} value={m.org_id}>{m.org_name}</option>
        ))}
      </NativeSelect>
    ) : (
      orgName && <p className="truncate text-sm text-sidebar-foreground/70">{orgName}</p>
    );

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-jarilla focus:px-4 focus:py-3 focus:text-basalto">
        Saltar al contenido
      </a>

      {/* Escritorio: riel de basalto */}
      <aside className="hidden bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <Link href="/proyectos" className="flex items-center gap-3 px-5 pb-6 pt-6 text-jarilla">
          <Mark className="size-9" />
          <span className="font-heading text-2xl font-semibold leading-none tracking-tight text-white">EIA</span>
        </Link>
        <nav aria-label="Principal" className="grid gap-1 px-3">
          {items.map((n) => {
            const active = isActive(path, n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-base font-medium transition-colors",
                  active
                    ? "border-jarilla bg-sidebar-accent text-white"
                    : "border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-sidebar-border p-4">
          <EstadoCampo online={online} pending={pending} />
          {orgPicker}
          <button
            type="button"
            onClick={salir}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-base text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-5" />
            Salir
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Celular: barra superior de basalto con pestañas */}
        <header className="sticky top-0 z-20 bg-sidebar text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-3 px-4 pt-2">
            <Link href="/proyectos" className="flex items-center gap-2 py-1 text-jarilla">
              <Mark className="size-7" />
              <span className="font-heading text-xl font-semibold text-white">EIA</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              {memberships.length > 1 && <div className="w-40">{orgPicker}</div>}
              <button
                type="button"
                onClick={salir}
                aria-label="Salir"
                className="grid size-11 cursor-pointer place-items-center rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <LogOut aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
          {/* en su propia fila: junto al logo no entra en 360 px */}
          <EstadoCampo online={online} pending={pending} className="px-4 pt-1" />
          <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-2">
            {items.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center whitespace-nowrap border-b-4 px-3 text-base font-medium",
                    active ? "border-jarilla text-white" : "border-transparent text-sidebar-foreground/70",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main id="contenido" className="mx-auto max-w-[90rem] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
