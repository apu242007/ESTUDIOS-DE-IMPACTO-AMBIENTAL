import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EiaDB } from "./db";
import { addPhoto, addWaypoint, createLine, deleteLine, saveLine } from "./repo";

const P = "p1";
let db: EiaDB;
beforeEach(() => {
  db = new EiaDB(`repo-${Math.random()}`);
});

describe("repo offline", () => {
  it("la ficha nueva numera y hereda de la anterior ('usar el último')", async () => {
    const a = await createLine(P, db);
    await saveLine(a.id, { company: "Consultora SA", dominant: "Jarilla", kind: "ducto" }, db);
    const b = await createLine(P, db);
    expect(a.fichaNo).toBe(1);
    expect(b.fichaNo).toBe(2);
    expect(b).toMatchObject({ company: "Consultora SA", dominant: "Jarilla", kind: "ducto" });
  });

  it("los waypoints se numeran correlativos", async () => {
    const l = await createLine(P, db);
    const w1 = await addWaypoint(l.id, db);
    const w2 = await addWaypoint(l.id, db);
    expect([w1?.number, w2?.number]).toEqual([1, 2]);
  });

  it("cada escritura deja su entrada en la cola", async () => {
    const l = await createLine(P, db);
    await addWaypoint(l.id, db);
    expect(await db.outbox.count()).toBe(2);
  });

  it("borrar la ficha limpia hijos y deja solo el borrado en la cola de esa ficha", async () => {
    const l = await createLine(P, db);
    const w = await addWaypoint(l.id, db);
    await addPhoto({ orgId: "o", projectId: P, lineId: l.id, waypointId: w!.id, category: "otro", caption: null, heading: null, blob: new Blob(["x"]) }, db);
    await deleteLine(l.id, db);
    expect(await db.waypoints.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    const left = await db.outbox.toArray();
    expect(left.filter((e) => e.id === l.id).map((e) => e.op)).toEqual(["delete"]);
  });
});
