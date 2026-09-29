"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/proyectos" : "/login");
  }, [loading, session, router]);

  return (
    <main className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</main>
  );
}
