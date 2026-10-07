import { describe, expect, it } from "vitest";
import { estadoWorker, haceCuanto } from "./cola";

const ahora = new Date("2026-10-07T12:00:00Z").getTime();

describe("estado del worker según su latido", () => {
  it("vivo si dio señales en los últimos 90 s; apagado si no; sin dato si nunca latió", () => {
    expect(estadoWorker("2026-10-07T11:59:20Z", ahora)).toBe("vivo");
    expect(estadoWorker("2026-10-07T11:55:00Z", ahora)).toBe("apagado");
    expect(estadoWorker(null, ahora)).toBe("apagado");
  });

  it("con la PC apagada, si el worker de la nube (GitHub Actions) corrió en la última hora, se procesa en minutos", () => {
    expect(estadoWorker("2026-10-06T10:00:00Z", ahora, "2026-10-07T11:50:00Z")).toBe("nube");
    expect(estadoWorker("2026-10-06T10:00:00Z", ahora, "2026-10-07T09:00:00Z")).toBe("apagado"); // hace 3 h: dejó de correr
    expect(estadoWorker("2026-10-07T11:59:50Z", ahora, "2026-10-07T11:50:00Z")).toBe("vivo");  // la PC manda si está viva
  });
});

describe("tiempo en cola", () => {
  it("lo dice en palabras", () => {
    expect(haceCuanto("2026-10-07T11:59:30Z", ahora)).toBe("hace menos de un minuto");
    expect(haceCuanto("2026-10-07T11:48:00Z", ahora)).toBe("hace 12 minutos");
    expect(haceCuanto("2026-10-07T09:00:00Z", ahora)).toBe("hace 3 horas");
    expect(haceCuanto("2026-10-05T12:00:00Z", ahora)).toBe("hace 2 días");
  });
});
