import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EiaDB, type LineRec, type WaypointRec } from "./db";
import { enqueue, pendingCount, syncOutbox, type Remote } from "./sync";

const P = "proj-1";
const line = (id: string): LineRec => ({
  id, projectId: P, workId: null, kind: "ducto", startLabel: "001", endLabel: "020", fichaNo: 1, jobNo: null,
  surveyDate: null, company: null, dominant: null, cover: null, companions: null, notes: null, closed: false, updatedAt: 1,
});
const wp = (id: string, lineId: string): WaypointRec => ({
  id, projectId: P, lineId, number: 8, code: "CR", description: null, views: "O-SO", lat: null, lon: null,
  elevationM: null, source: "manual", sortOrder: 1, updatedAt: 1,
});

let db: EiaDB;
let calls: string[];
let failOn: string | null;
const remote: Remote = {
  async upsertLine(l) { if (failOn === "line") throw new Error("sin red"); calls.push(`line:${l.id}`); },
  async upsertWaypoint(w) { if (failOn === "wp") throw new Error("sin red"); calls.push(`wp:${w.id}`); },
  async uploadPhoto(p) { calls.push(`photo:${p.id}`); },
  async remove(t, id) { calls.push(`del:${t}:${id}`); },
};

beforeEach(async () => {
  db = new EiaDB(`test-${Math.random()}`);
  calls = [];
  failOn = null;
});

describe("syncOutbox", () => {
  it("envía en orden de cola y la vacía", async () => {
    await db.lines.put(line("L1"));
    await enqueue("lines", "L1", "upsert", P, db);
    await db.waypoints.put(wp("W1", "L1"));
    await enqueue("waypoints", "W1", "upsert", P, db);

    const r = await syncOutbox(remote, P, db);
    expect(calls).toEqual(["line:L1", "wp:W1"]);
    expect(r).toEqual({ sent: 2, pending: 0 });
    expect(await pendingCount(P, db)).toBe(0);
  });

  it("ante un error se detiene y conserva lo pendiente (no envía hijos sin padre)", async () => {
    await db.lines.put(line("L1"));
    await enqueue("lines", "L1", "upsert", P, db);
    await db.waypoints.put(wp("W1", "L1"));
    await enqueue("waypoints", "W1", "upsert", P, db);

    failOn = "line";
    const r = await syncOutbox(remote, P, db);
    expect(r.error).toBe("sin red");
    expect(r.sent).toBe(0);
    expect(calls).toEqual([]);
    expect(await pendingCount(P, db)).toBe(2);

    failOn = null; // vuelve la conexión
    expect((await syncOutbox(remote, P, db)).sent).toBe(2);
    expect(calls).toEqual(["line:L1", "wp:W1"]);
  });

  it("una edición durante el envío deja su propia entrada en la cola", async () => {
    await db.lines.put(line("L1"));
    await enqueue("lines", "L1", "upsert", P, db);
    let edited = false;
    const slow: Remote = {
      ...remote,
      async upsertLine(l) {
        calls.push(`line:${l.id}`);
        if (edited) return;
        edited = true; // el usuario edita la ficha mientras se envía la primera vez
        await db.lines.update("L1", { notes: "editada" });
        await enqueue("lines", "L1", "upsert", P, db);
      },
    };
    await syncOutbox(slow, P, db);
    expect(await pendingCount(P, db)).toBe(1);
    await syncOutbox(slow, P, db);
    expect(await pendingCount(P, db)).toBe(0);
  });

  it("borrados se envían y filas locales ya inexistentes se omiten", async () => {
    await enqueue("waypoints", "W9", "delete", P, db);
    await enqueue("waypoints", "fantasma", "upsert", P, db); // borrado local antes de sincronizar
    const r = await syncOutbox(remote, P, db);
    expect(calls).toEqual(["del:waypoints:W9"]);
    expect(r.pending).toBe(0);
  });

  it("solo toca la cola del proyecto pedido", async () => {
    await db.lines.put(line("L1"));
    await enqueue("lines", "L1", "upsert", P, db);
    await db.lines.put({ ...line("L2"), projectId: "otro" });
    await enqueue("lines", "L2", "upsert", "otro", db);
    await syncOutbox(remote, P, db);
    expect(calls).toEqual(["line:L1"]);
    expect(await pendingCount("otro", db)).toBe(1);
  });
});
