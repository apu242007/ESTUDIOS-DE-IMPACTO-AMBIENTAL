"use client";

import { useQuery } from "@tanstack/react-query";
import { estadoWorker, haceCuanto } from "@/lib/cola";
import { getWorkerSeen } from "@/lib/data/worker";

const COMANDO = String.raw`powershell -ExecutionPolicy Bypass -File apps\worker\run_worker.ps1`;

/** Qué pasa con un trabajo "en cola": si el procesador está encendido lo toma en segundos; si está apagado,
 * se dice desde cuándo no da señales y cómo encenderlo, en vez de dejar "En cola" sin explicación. */
export function EnCola() {
  const { data: seen, isLoading } = useQuery({ queryKey: ["worker-seen"], queryFn: getWorkerSeen, refetchInterval: 15_000 });
  if (isLoading) return null;
  if (estadoWorker(seen ?? null) === "vivo") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <span aria-hidden="true" className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-ok" />
        </span>
        El procesador está encendido: lo toma en unos segundos.
      </p>
    );
  }
  return (
    <div role="alert" className="grid gap-2 border border-warn bg-warn/5 p-3 text-sm">
      <p>
        <strong>El procesador está apagado</strong>
        {seen ? ` (última señal ${haceCuanto(seen)})` : ""}. Este archivo está en cola y se procesa solo cuando se encienda.
      </p>
      <p>
        Encendelo en la PC de la consultora con:{" "}
        <code className="select-all break-all bg-card px-1.5 py-0.5 font-mono text-xs">{COMANDO}</code>
      </p>
    </div>
  );
}
