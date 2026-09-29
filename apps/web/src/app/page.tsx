"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Estado = "probando" | "conectado" | "error";

export default function Home() {
  const [estado, setEstado] = useState<Estado>("probando");
  const [detalle, setDetalle] = useState("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setEstado("error");
      setDetalle("Faltan las variables de Supabase");
      return;
    }
    createClient(); // valida que el cliente se puede crear
    fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
      .then((r) => {
        setEstado(r.ok ? "conectado" : "error");
        setDetalle(`HTTP ${r.status}`);
      })
      .catch((e: unknown) => {
        setEstado("error");
        setDetalle(e instanceof Error ? e.message : "Sin respuesta");
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">EIA</h1>
      <p className="text-lg">Sistema de informes de impacto ambiental.</p>
      <p role="status" className="rounded-lg border p-4 text-lg">
        Supabase:{" "}
        <strong>
          {estado === "probando" && "probando…"}
          {estado === "conectado" && "conectado ✅"}
          {estado === "error" && "sin conexión ❌"}
        </strong>
        {detalle && <span className="text-sm opacity-70"> ({detalle})</span>}
      </p>
    </main>
  );
}
