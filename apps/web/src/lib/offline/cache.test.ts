import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { cached, isNetworkError } from "./cache";

const row = z.object({ id: z.string() });
const sinRed = () => Promise.reject(new Error("TypeError: Failed to fetch"));

describe("isNetworkError", () => {
  it("reconoce la falta de red de Chrome, Safari y Firefox", () => {
    expect(isNetworkError(new Error("TypeError: Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("TypeError: Load failed"))).toBe(true);
    expect(isNetworkError(new Error("TypeError: NetworkError when attempting to fetch resource."))).toBe(true);
  });
  it("no confunde errores del servidor o de datos con falta de red", () => {
    expect(isNetworkError(new Error("permission denied for table projects"))).toBe(false);
    expect(isNetworkError(new Error("JSON object requested, multiple (or no) rows returned"))).toBe(false);
  });
});

describe("cached", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sin señal no espera los reintentos de la red: usa la copia o avisa al instante", async () => {
    const key = `k-${Math.random()}`;
    await cached(key, row, async () => [{ id: "a" }], isNetworkError);
    vi.stubGlobal("navigator", { onLine: false });
    const fetcher = vi.fn(async () => [{ id: "b" }]);
    expect(await cached(key, row, fetcher, isNetworkError)).toEqual([{ id: "a" }]);
    await expect(cached(`k-${Math.random()}`, row, fetcher, isNetworkError)).rejects.toThrow("sin copia");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("guarda la copia y la usa si después falta la red", async () => {
    const key = `k-${Math.random()}`;
    expect(await cached(key, row, async () => [{ id: "a" }], isNetworkError)).toEqual([{ id: "a" }]);
    expect(await cached(key, row, sinRed, isNetworkError)).toEqual([{ id: "a" }]);
  });
  it("sin copia guardada relanza el error", async () => {
    await expect(cached(`k-${Math.random()}`, row, sinRed, isNetworkError)).rejects.toThrow("Failed to fetch");
  });
  it("un error que no es de red se muestra aunque haya copia", async () => {
    const key = `k-${Math.random()}`;
    await cached(key, row, async () => [{ id: "a" }], isNetworkError);
    await expect(
      cached(key, row, () => Promise.reject(new Error("permission denied")), isNetworkError),
    ).rejects.toThrow("permission denied");
  });
  it("sin fallback explícito, un error que no es de red tampoco se tapa con la copia", async () => {
    // catálogos, lista de proyectos y obras llaman a cached() sin fallback
    const key = `k-${Math.random()}`;
    await cached(key, row, async () => [{ id: "a" }]);
    await expect(cached(key, row, () => Promise.reject(new Error("permission denied")))).rejects.toThrow("permission denied");
    expect(await cached(key, row, () => Promise.reject(new Error("TypeError: Failed to fetch")))).toEqual([{ id: "a" }]);
  });
  it("datos con formato inválido no se guardan ni pisan la copia", async () => {
    const key = `k-${Math.random()}`;
    await cached(key, row, async () => [{ id: "a" }], isNetworkError);
    await expect(cached(key, row, async () => [{ id: 1 }], isNetworkError)).rejects.toThrow();
    expect(await cached(key, row, sinRed, isNetworkError)).toEqual([{ id: "a" }]);
  });
});
