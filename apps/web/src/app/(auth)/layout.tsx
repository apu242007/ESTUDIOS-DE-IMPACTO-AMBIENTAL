"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

/** Retícula de coordenadas Gauss-Krüger, como la cuadrícula de una carta: líneas cada 1.000 m con su rótulo. */
function Reticula() {
  const norte = [5781000, 5780000, 5779000, 5778000, 5777000, 5776000];
  const este = [2535000, 2536000, 2537000, 2538000, 2539000];
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full text-white/15" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
      {norte.map((_, i) => <line key={`n${i}`} x1="0" x2="100" y1={8 + i * 17} y2={8 + i * 17} stroke="currentColor" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />)}
      {este.map((_, i) => <line key={`e${i}`} y1="0" y2="100" x1={10 + i * 20} x2={10 + i * 20} stroke="currentColor" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />)}
      {norte.map((v, i) => <text key={`tn${i}`} x="1" y={7 + i * 17} fontSize="2.2" fill="currentColor" fontFamily="var(--font-rot)">{v.toLocaleString("es-AR")}</text>)}
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { session, offline, loading, memberships } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading || (!session && !offline)) return;
    // ya autenticado: onboarding si no tiene organización, si no a la app
    const target = memberships.length === 0 ? "/onboarding" : "/proyectos";
    if (!path.startsWith(target)) router.replace(target);
  }, [loading, session, offline, memberships.length, path, router]);

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-foreground px-6 py-8 text-white md:flex md:min-h-screen md:flex-col md:justify-between md:p-12">
        <Reticula />
        <div className="relative flex items-center gap-3">
          <span className="font-heading text-3xl font-extrabold leading-none tracking-wide [font-stretch:125%]">EIA</span>
          <span aria-hidden="true" className="grid h-2 w-20 grid-cols-4 border border-white">
            <i className="bg-white" /><i /><i className="bg-white" /><i />
          </span>
        </div>
        <div className="relative mt-8 max-w-md md:mt-0">
          <p className="font-heading text-3xl font-extrabold leading-[1.05] [font-stretch:112%] md:text-5xl">
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
