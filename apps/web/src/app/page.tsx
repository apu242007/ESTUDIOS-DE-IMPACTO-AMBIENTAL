"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const { session, offline, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session || offline ? "/proyectos" : "/login");
  }, [loading, session, offline, router]);

  return (
    <main className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</main>
  );
}
