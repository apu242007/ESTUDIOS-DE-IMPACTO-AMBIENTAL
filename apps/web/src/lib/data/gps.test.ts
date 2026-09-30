import { describe, expect, it } from "vitest";
import { gpsImportSchema, gpsKindOf } from "./gps";

describe("gpsKindOf", () => {
  it("acepta .gdb y .gpx sin distinguir mayúsculas; rechaza el resto", () => {
    expect(gpsKindOf("PAD58.GDB")).toBe("gdb");
    expect(gpsKindOf("ruta.gpx")).toBe("gpx");
    expect(gpsKindOf("capa.shp")).toBeNull();
    expect(gpsKindOf("sinextension")).toBeNull();
  });
});

describe("gpsImportSchema", () => {
  const base = {
    id: "1", file_path: "o/p/gps/x/a.gdb", file_kind: "gdb", status: "listo",
    n_points: 3, n_matched: 2, n_unmatched: 1, error: null, created_at: "2026-09-30T00:00:00Z",
  };
  it("lee el informe del worker", () => {
    const r = gpsImportSchema.parse({ ...base, report: { unmatched_points: ["099"], unmatched_waypoints: [6], ambiguous: [], duplicates: [] } });
    expect(r.report?.unmatched_waypoints).toEqual([6]);
  });
  it("un informe con otra forma no rompe la lista", () => {
    expect(gpsImportSchema.parse({ ...base, report: { raro: true } }).report).toBeNull();
    expect(gpsImportSchema.parse({ ...base, report: null }).report).toBeNull();
  });
});
