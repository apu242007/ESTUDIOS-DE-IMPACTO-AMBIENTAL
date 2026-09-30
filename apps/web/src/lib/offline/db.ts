import Dexie, { type EntityTable } from "dexie";

export type LineRec = {
  id: string;
  projectId: string;
  workId: string | null;
  kind: string | null;
  startLabel: string | null;
  endLabel: string | null;
  fichaNo: number | null;
  jobNo: string | null;
  surveyDate: string | null;
  company: string | null;
  dominant: string | null;
  cover: string | null;
  companions: string | null;
  notes: string | null;
  closed: boolean;
  updatedAt: number;
};

export type WaypointRec = {
  id: string;
  projectId: string;
  lineId: string;
  number: number | null;
  code: string | null;
  description: string | null;
  views: string | null;
  lat: number | null;
  lon: number | null;
  elevationM: number | null;
  source: "telefono" | "manual";
  sortOrder: number;
  updatedAt: number;
};

export type PhotoRec = {
  id: string;
  orgId: string;
  projectId: string;
  lineId: string;
  waypointId: string | null;
  category: string;
  caption: string | null;
  heading: string | null;
  takenAt: string;
  blob: Blob;
  uploaded: boolean;
};

export type OutboxTable = "lines" | "waypoints" | "photos";
export type OutboxRec = { seq?: number; table: OutboxTable; id: string; op: "upsert" | "delete"; projectId: string };
export type CatalogRec = { key: string; value: unknown; savedAt: number };

export class EiaDB extends Dexie {
  lines!: EntityTable<LineRec, "id">;
  waypoints!: EntityTable<WaypointRec, "id">;
  photos!: EntityTable<PhotoRec, "id">;
  outbox!: EntityTable<OutboxRec, "seq">;
  catalogs!: EntityTable<CatalogRec, "key">;

  constructor(name = "eia") {
    super(name);
    this.version(1).stores({
      lines: "id, projectId",
      waypoints: "id, projectId, lineId",
      photos: "id, projectId, waypointId",
      outbox: "++seq, table, id, projectId",
      catalogs: "key",
    });
  }
}

let db: EiaDB | undefined;
/** Perezoso: la exportación estática prerenderiza en Node, donde no existe IndexedDB. */
export function getDb(): EiaDB {
  return (db ??= new EiaDB());
}
