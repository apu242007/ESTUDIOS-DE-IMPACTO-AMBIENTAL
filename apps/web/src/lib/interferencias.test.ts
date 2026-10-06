import { describe, expect, it } from "vitest";
import { buildInterferencias, renderTemplate, toCsv, type WaypointInput } from "./interferencias";

// Punto de A.7/A.8: lat -38°7'47.78", lon -68°34'8.97" → X≈5779960, Y≈2537773 (el informe redondea; PROJ da 5779957 / 2537775)
const LAT = -(38 + 7 / 60 + 47.78 / 3600);
const LON = -(68 + 34 / 60 + 8.97 / 3600);

const wp = (o: Partial<WaypointInput>): WaypointInput => ({
  id: "w", lineId: "l1", number: 1, code: null, description: null, views: null, lat: LAT, lon: LON, elevationM: 138.4, ...o,
});
const codes = new Map([["CR", "Cruce"], ["CC", "Cauce"]]);
const lines = new Map([["l1", { fichaNo: 1 }], ["l2", { fichaNo: 2 }]]);

describe("buildInterferencias", () => {
  it("reproduce la fila del informe: DMS, X norte, Y este, cota entera", () => {
    const { rows } = buildInterferencias([wp({ code: "CR", description: "con ductos (4)" })], codes, lines);
    expect(rows[0]).toMatchObject({ figura: "Cruce", lat: `38° 7'47.78"S`, lon: `68°34'8.97"O`, cota: 138 });
    expect(Math.abs(rows[0].x - 5779960)).toBeLessThan(5);
    expect(Math.abs(rows[0].y - 2537773)).toBeLessThan(5);
    expect(rows[0].x).toBeGreaterThan(rows[0].y); // X es el norte (mayor que el este en esta faja)
  });

  it("sin sigla usa 'Punto de interés'; sin posición no entra pero se cuenta", () => {
    const inicio = { description: "Inicio de línea de captación 8\"" };
    const r = buildInterferencias([wp({ id: "a", ...inicio }), wp({ id: "b", ...inicio, lat: null, lon: null })], codes, lines);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].figura).toBe("Punto de interés");
    expect(r.sinPosicion).toBe(1);
  });

  it("descripción por defecto: solo junta lo cargado (no inventa)", () => {
    const a = buildInterferencias([wp({ code: "CC", description: "seco", views: "O-NO" })], codes, lines).rows[0];
    expect(a.descripcion).toBe("Cauce: seco"); // las vistas son de las fotos (anexo), no de la interferencia
    const b = buildInterferencias([wp({ code: "CC" })], codes, lines).rows[0];
    expect(b.descripcion).toBe("Cauce");
  });

  it("ordena por ficha y luego por N° de waypoint", () => {
    const r = buildInterferencias(
      [wp({ id: "c", lineId: "l2", number: 1, code: "CR" }), wp({ id: "b", number: 9, code: "CR" }), wp({ id: "a", number: 2, code: "CR" })],
      codes, lines,
    );
    expect(r.rows.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  // Misma regla que el informe (apps/worker/app/jobs/docs.py, build_interferencias): lo que se revisa en pantalla
  // y en el CSV es lo que recibe el cliente.
  it("formato cliente: sin quiebres ni notas de campo, siglas expandidas", () => {
    const c = new Map([["CR", "Cruce"], ["CP", "Camino principal"], ["CaC", "Caño camisa"], ["Q", "Quiebre"], ["O", "Oleoducto"]]);
    const r = buildInterferencias([
      wp({ id: "1", number: 9, code: "CR", description: "CR con CP - CaC", views: "O-SO" }),
      wp({ id: "2", number: 10, code: "Q", description: "Q al O" }),
      wp({ id: "3", number: 4, description: "Inicio en PAD 60 BPO" }),
      wp({ id: "4", number: 50, description: "VNO" }),
      wp({ id: "5", number: 51 }),
    ], c, lines);
    expect(r.rows.map((x) => x.id)).toEqual(["3", "1"]);
    expect(r.rows[1].descripcion).toBe("Cruce con camino principal - caño camisa");
    expect(r.rows[0]).toMatchObject({ figura: "Punto de interés", descripcion: "Inicio en PAD 60 BPO" });
  });

  it("fichas sin número no intercalan sus waypoints (mismo orden que el informe)", () => {
    const sinNum = new Map([["a", { fichaNo: null }], ["b", { fichaNo: null }]]);
    const r = buildInterferencias(
      [1, 2].flatMap((n) => ["a", "b"].map((l) => wp({ id: `${l}${n}`, lineId: l, number: n, code: "CR" }))), codes, sinNum,
    );
    expect(r.rows.map((x) => x.id)).toEqual(["a1", "a2", "b1", "b2"]);
  });

  it("usa la plantilla del catálogo cuando existe", () => {
    const r = buildInterferencias([wp({ code: "CR", number: 8, views: "S-O" })], codes, lines, "{figura} N° {numero}, vistas {vistas}.");
    expect(r.rows[0].descripcion).toBe("Cruce N° 8, vistas S-O.");
  });
});

describe("renderTemplate", () => {
  it("variables faltantes quedan vacías y no dejan espacios ni signos sueltos", () => {
    expect(renderTemplate("{figura} {observaciones}.", { figura: "Cruce" })).toBe("Cruce.");
    expect(renderTemplate("Punto {numero} , {figura}", { numero: 4, figura: "Cauce" })).toBe("Punto 4, Cauce");
  });
});

describe("toCsv", () => {
  it("BOM, separador ; y comillas escapadas para Excel", () => {
    const { rows } = buildInterferencias([wp({ code: "CR", description: 'con "ductos"; 4' })], codes, lines);
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿Figura;Latitud;Longitud;X;Y;Cota;Descripción\r\n")).toBe(true);
    expect(csv).toContain('"Cruce: con ""ductos""; 4"');
  });
});
