import { getDb, type EiaDB, type LineRec, type OutboxTable, type PhotoRec, type WaypointRec } from "./db";

/** Transporte al servidor. Se inyecta para poder probar la sincronización sin red. */
export interface Remote {
  upsertLine(l: LineRec): Promise<void>;
  upsertWaypoint(w: WaypointRec): Promise<void>;
  uploadPhoto(p: PhotoRec): Promise<void>;
  remove(table: OutboxTable, id: string): Promise<void>;
}

export type SyncResult = { sent: number; pending: number; error?: string };

/** Anota un cambio local para enviarlo luego. Siempre se llama después de escribir la fila local. */
export async function enqueue(
  table: OutboxTable,
  id: string,
  op: "upsert" | "delete",
  projectId: string,
  db: EiaDB = getDb(),
) {
  await db.outbox.add({ table, id, op, projectId });
}

export const pendingCount = (projectId: string, db: EiaDB = getDb()) =>
  db.outbox.where("projectId").equals(projectId).count();

/**
 * Envía la cola en orden (ficha → waypoint → foto, por como se encolan). Ante el primer error se detiene:
 * los hijos dependen de los padres. Cada entrada se confirma sola; si la fila se editó durante el envío,
 * su entrada nueva (seq mayor) sigue en la cola. El envío es idempotente (upsert por id de cliente).
 */
export async function syncOutbox(remote: Remote, projectId: string, db: EiaDB = getDb()): Promise<SyncResult> {
  const entries = await db.outbox.where("projectId").equals(projectId).sortBy("seq");
  let sent = 0;
  for (const e of entries) {
    try {
      if (e.op === "delete") {
        await remote.remove(e.table, e.id);
      } else if (e.table === "lines") {
        const row = await db.lines.get(e.id);
        if (row) await remote.upsertLine(row);
      } else if (e.table === "waypoints") {
        const row = await db.waypoints.get(e.id);
        if (row) await remote.upsertWaypoint(row);
      } else {
        const row = await db.photos.get(e.id);
        if (row && !row.uploaded) {
          await remote.uploadPhoto(row);
          await db.photos.update(e.id, { uploaded: true });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Error de sincronización";
      return { sent, pending: entries.length - sent, error };
    }
    await db.outbox.delete(e.seq as number);
    sent++;
  }
  return { sent, pending: 0 };
}
