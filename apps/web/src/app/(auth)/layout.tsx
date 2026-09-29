"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">EIA</h1>
        <p className="text-muted-foreground">Informes de impacto ambiental</p>
      </div>
      {children}
    </main>
  );
}
