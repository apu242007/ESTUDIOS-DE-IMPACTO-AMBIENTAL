import { describe, expect, it } from "vitest";
import { groupLayerFiles } from "./layer-files";

const f = (name: string) => new File(["x"], name);

describe("groupLayerFiles", () => {
  it("agrupa un SHP y lista lo que falta", () => {
    const { groups } = groupLayerFiles([f("Caminos.shp"), f("Caminos.dbf")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ baseName: "Caminos", format: "shp", missing: ["shx", "prj"] });
  });

  it("no distingue mayúsculas entre principal y sidecars", () => {
    const { groups } = groupLayerFiles([f("Pozos.SHP"), f("pozos.prj"), f("POZOS.dbf"), f("pozos.shx")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].missing).toEqual([]);
    expect(groups[0].files).toHaveLength(4);
  });

  it("KMZ va solo y sin faltantes; separa capas distintas", () => {
    const { groups } = groupLayerFiles([f("Acueducto.kmz"), f("Pozos.shp")]);
    expect(groups.map((g) => g.format).sort()).toEqual(["kmz", "shp"]);
    expect(groups.find((g) => g.format === "kmz")?.missing).toEqual([]);
  });

  it("descarta extensiones no permitidas y sidecars huérfanos", () => {
    const { groups, ignored } = groupLayerFiles([f("a.exe"), f("huerfano.dbf"), f("ok.kml")]);
    expect(groups).toHaveLength(1);
    expect(ignored.sort()).toEqual(["a.exe", "huerfano.dbf"]);
  });
});
