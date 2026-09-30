"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Contours, Mark } from "@/components/brand";
import { useAuth } from "@/lib/auth/auth-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, memberships } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading || !session) return;
    // ya autenticado: onboarding si no tiene organización, si no a la app
    const target = memberships.length === 0 ? "/onboarding" : "/proyectos";
    if (!path.startsWith(target)) router.replace(target);
  }, [loading, session, memberships.length, path, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Contours className="pointer-events-none absolute -right-24 -top-16 size-[42rem] text-primary/10" />
      <main className="relative mx-auto grid min-h-screen w-full max-w-md content-center gap-6 p-6">
        <div className="flex items-center gap-3 text-primary">
          <Mark className="size-12" />
          <div className="text-foreground">
            <h1 className="font-heading text-3xl font-semibold leading-none">EIA</h1>
            <p className="mt-1 text-muted-foreground">Informes ambientales de proyectos petroleros</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
