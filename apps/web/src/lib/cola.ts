/** Cola de trabajos del worker (capas, GPS, informes, figuras): ¿el procesador está encendido? */

/** El worker escribe su latido cada 30 s (worker_heartbeat, 0023): sin señales en 90 s se considera apagado. */
export function estadoWorker(seenAt: string | null, ahora = Date.now()): "vivo" | "apagado" {
  return seenAt !== null && ahora - new Date(seenAt).getTime() < 90_000 ? "vivo" : "apagado";
}

export function haceCuanto(desde: string, ahora = Date.now()): string {
  const min = Math.floor((ahora - new Date(desde).getTime()) / 60_000);
  if (min < 1) return "hace menos de un minuto";
  if (min < 60) return `hace ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}
