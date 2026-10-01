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
    <div className="min-h-screen bg-background md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-basalto px-6 py-8 text-white md:flex md:min-h-screen md:flex-col md:justify-between md:p-12">
        <Contours className="pointer-events-none absolute -bottom-24 -right-32 size-[46rem] text-jarilla/25" />
        <div className="relative flex items-center gap-3 text-jarilla">
          <Mark className="size-10" />
          <span className="font-heading text-3xl font-semibold leading-none text-white">EIA</span>
        </div>
        <div className="relative mt-8 max-w-md md:mt-0">
          <p className="font-heading text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            Del relevamiento al informe, en un solo lugar.
          </p>
          <p className="mt-4 text-base text-white/75 md:text-lg">
            Cargá el alcance y las capas, relevá en campo sin conexión y generá el Word y el PDF con la tabla de
            interferencias y el anexo fotográfico.
          </p>
        </div>
        <p className="relative mt-8 hidden text-sm text-white/55 md:block">Uso interno de la consultora.</p>
      </aside>
      <main className="mx-auto grid w-full max-w-md content-center gap-6 p-6 md:min-h-screen md:p-10">{children}</main>
    </div>
  );
}
