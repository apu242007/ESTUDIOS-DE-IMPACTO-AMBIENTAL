import { getDb, type EiaDB, type LineRec, type PhotoRec, type WaypointRec } from "./db";

type LinePatch = Partial<Omit<LineRec, "id" | "projectId" | "updatedAt">>;
type WaypointPatch = Partial<Omit<WaypointRec, "id" | "projectId" | "lineId" | "updatedAt">>;

const today = () => new Date().toISOString().slice(0, 10);

/** "Usar el último": una ficha nueva hereda lo que casi nunca cambia de la anterior del proyecto. */
export async function createLine(projectId: string, db: EiaDB = getDb()): Promise<LineRec> {
  const prev = (await db.lines.where("projectId").equals(projectId).sortBy("updatedAt")).at(-1);
  const all = await db.lines.where("projectId").equals(projectId).toArray();
  const line: LineRec = {
    id: crypto.randomUUID(),
    projectId,
    workId: null,
    kind: prev?.kind ?? null,
    startLabel: null,
    endLabel: null,
    fichaNo: Math.max(0, ...all.map((l) => l.fichaNo ?? 0)) + 1,
    jobNo: prev?.jobNo ?? null,
    surveyDate: today(),
    company: prev?.company ?? null,
    dominant: prev?.dominant ?? null,
    cover: prev?.cover ?? null,
    companions: prev?.companions ?? null,
    notes: null,
    closed: false,
    updatedAt: Date.now(),
  };
  await db.transaction("rw", db.lines, db.outbox, async () => {
    await db.lines.add(line);
    await db.outbox.add({ table: "lines", id: line.id, op: "upsert", projectId });
  });
  return line;
}

export async function saveLine(id: string, patch: LinePatch, db: EiaDB = getDb()) {
  await db.transaction("rw", db.lines, db.outbox, async () => {
    const cur = await db.lines.get(id);
    if (!cur) return;
    await db.lines.update(id, { ...patch, updatedAt: Date.now() });
    await db.outbox.add({ table: "lines", id, op: "upsert", projectId: cur.projectId });
  });
}

export async function deleteLine(id: string, db: EiaDB = getDb()) {
  await db.transaction("rw", [db.lines, db.waypoints, db.photos, db.outbox], async () => {
    const cur = await db.lines.get(id);
    if (!cur) return;
    await db.photos.where("waypointId").anyOf(
      (await db.waypoints.where("lineId").equals(id).primaryKeys()) as string[],
    ).delete();
    await db.waypoints.where("lineId").equals(id).delete();
    await db.lines.delete(id);
    // el servidor borra en cascada waypoints y desliga fotos; el resto de la cola de esta ficha ya no aplica
    await db.outbox.where("projectId").equals(cur.projectId).filter((e) => e.id === id).delete();
    await db.outbox.add({ table: "lines", id, op: "delete", projectId: cur.projectId });
  });
}

export async function addWaypoint(lineId: string, db: EiaDB = getDb()): Promise<WaypointRec | null> {
  const line = await db.lines.get(lineId);
  if (!line) return null;
  const mine = await db.waypoints.where("lineId").equals(lineId).toArray();
  const last = mine.sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
  const wp: WaypointRec = {
    id: crypto.randomUUID(),
    projectId: line.projectId,
    lineId,
    number: (last?.number ?? 0) + 1,
    code: null,
    description: null,
    views: null,
    lat: null,
    lon: null,
    elevationM: null,
    source: "manual",
    sortOrder: (last?.sortOrder ?? 0) + 1,
    updatedAt: Date.now(),
  };
  await db.transaction("rw", db.waypoints, db.outbox, async () => {
    await db.waypoints.add(wp);
    await db.outbox.add({ table: "waypoints", id: wp.id, op: "upsert", projectId: wp.projectId });
  });
  return wp;
}

export async function saveWaypoint(id: string, patch: WaypointPatch, db: EiaDB = getDb()) {
  await db.transaction("rw", db.waypoints, db.outbox, async () => {
    const cur = await db.waypoints.get(id);
    if (!cur) return;
    await db.waypoints.update(id, { ...patch, updatedAt: Date.now() });
    await db.outbox.add({ table: "waypoints", id, op: "upsert", projectId: cur.projectId });
  });
}

export async function deleteWaypoint(id: string, db: EiaDB = getDb()) {
  await db.transaction("rw", [db.waypoints, db.photos, db.outbox], async () => {
    const cur = await db.waypoints.get(id);
    if (!cur) return;
    await db.photos.where("waypointId").equals(id).delete();
    await db.waypoints.delete(id);
    await db.outbox.add({ table: "waypoints", id, op: "delete", projectId: cur.projectId });
  });
}

export async function addPhoto(
  p: Omit<PhotoRec, "id" | "uploaded" | "takenAt">,
  db: EiaDB = getDb(),
): Promise<PhotoRec> {
  const rec: PhotoRec = { ...p, id: crypto.randomUUID(), uploaded: false, takenAt: new Date().toISOString() };
  await db.transaction("rw", db.photos, db.outbox, async () => {
    await db.photos.add(rec);
    await db.outbox.add({ table: "photos", id: rec.id, op: "upsert", projectId: rec.projectId });
  });
  return rec;
}

export async function deletePhoto(id: string, db: EiaDB = getDb()) {
  await db.transaction("rw", db.photos, db.outbox, async () => {
    const cur = await db.photos.get(id);
    if (!cur) return;
    await db.photos.delete(id);
    await db.outbox.add({ table: "photos", id, op: "delete", projectId: cur.projectId });
  });
}
