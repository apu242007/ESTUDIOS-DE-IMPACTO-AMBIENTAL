import { describe, expect, it } from "vitest";
import { offlineIdentity, readAuthCache, writeAuthCache, type AuthCache } from "./offline-cache";

const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};
const ID: AuthCache = { userId: "u1", memberships: [{ org_id: "o1", role: "miembro", org_name: "Consultora" }] };

describe("identidad para trabajar sin conexión", () => {
  it("se guarda, se lee y se borra al salir", () => {
    const s = memStore();
    writeAuthCache(ID, s);
    expect(readAuthCache(s)).toEqual(ID);
    writeAuthCache(null, s);
    expect(readAuthCache(s)).toBeNull();
  });
  it("un valor corrupto se ignora", () => {
    const s = memStore();
    s.setItem("eia.auth", "{no es json");
    expect(readAuthCache(s)).toBeNull();
    s.setItem("eia.auth", JSON.stringify({ userId: "u1", memberships: [{ org_id: "o1", role: "dueño" }] }));
    expect(readAuthCache(s)).toBeNull();
  });
  it("solo habilita el modo sin conexión si falta la red y no se cerró la sesión", () => {
    expect(offlineIdentity(ID, true, false)).toEqual(ID);
    expect(offlineIdentity(ID, false, false)).toBeNull(); // con red y sin sesión: hay que ingresar
    expect(offlineIdentity(ID, true, true)).toBeNull(); // salió a propósito
    expect(offlineIdentity(null, true, false)).toBeNull(); // nunca entró en este teléfono
    expect(offlineIdentity({ userId: "u1", memberships: [] }, true, false)).toBeNull();
  });
});
