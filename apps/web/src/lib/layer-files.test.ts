import { describe, expect, it } from "vitest";
import { groupLayerFiles, storageName } from "./layer-files";

describe("storageName", () => {
  it("quita tildes y ñ para que Storage acepte la clave", () => {
    expect(storageName("Acueducto flexible temporal de agua de producción.shp")).toBe("Acueducto flexible temporal de agua de produccion.shp");
    expect(storageName("Estación de rebombeo (año 2026)#1.dbf")).toBe("Estacion de rebombeo (ano 2026)_1.dbf");
  });
});

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
