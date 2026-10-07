/** Cola de trabajos del worker (capas, GPS, informes, figuras): ¿el procesador está encendido? */

/**
 * Estado del procesador según los latidos (worker_heartbeat, 0023):
 * - "vivo": el worker de la PC dio señales en los últimos 90 s (escribe cada 30 s): lo toma en segundos.
 * - "nube": la PC no está, pero el worker de GitHub Actions corrió en la última hora (corre al entrar un trabajo
 *   y cada 15 min): se procesa en unos minutos.
 * - "apagado": ninguno de los dos.
 */
export function estadoWorker(seenPc: string | null, ahora = Date.now(), seenNube: string | null = null): "vivo" | "nube" | "apagado" {
  if (seenPc !== null && ahora - new Date(seenPc).getTime() < 90_000) return "vivo";
  if (seenNube !== null && ahora - new Date(seenNube).getTime() < 60 * 60_000) return "nube";
  return "apagado";
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
