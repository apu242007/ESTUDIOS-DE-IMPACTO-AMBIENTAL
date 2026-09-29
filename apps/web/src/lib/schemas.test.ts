import { describe, expect, it } from "vitest";
import {
  clientFormSchema,
  loginSchema,
  normalizeCuit,
  projectFormSchema,
  registerSchema,
} from "./schemas";

describe("loginSchema", () => {
  it("acepta datos válidos", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123456" }).success).toBe(true);
  });
  it("rechaza email inválido y contraseña corta", () => {
    expect(loginSchema.safeParse({ email: "x", password: "123456" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = { email: "a@b.com", password: "123456" };
  it("acepta contraseñas iguales", () => {
    expect(registerSchema.safeParse({ ...base, confirm: "123456" }).success).toBe(true);
  });
  it("rechaza contraseñas distintas en el campo confirm", () => {
    const r = registerSchema.safeParse({ ...base, confirm: "654321" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("normalizeCuit", () => {
  it("formatea 11 dígitos con o sin guiones", () => {
    expect(normalizeCuit("30123456789")).toBe("30-12345678-9");
    expect(normalizeCuit("30-12345678-9")).toBe("30-12345678-9");
  });
  it("deja intacto lo que no tiene 11 dígitos", () => {
    expect(normalizeCuit("123")).toBe("123");
  });
});

describe("clientFormSchema", () => {
  const ok = { name: "Acme", cuit: "30-12345678-9", contact_email: "" };
  it("acepta CUIT con y sin guiones, o vacío", () => {
    expect(clientFormSchema.safeParse(ok).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...ok, cuit: "30123456789" }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...ok, cuit: "" }).success).toBe(true);
  });
  it("rechaza CUIT que no tiene 11 dígitos", () => {
    expect(clientFormSchema.safeParse({ ...ok, cuit: "3012345678" }).success).toBe(false);
  });
  it("rechaza email inválido", () => {
    expect(clientFormSchema.safeParse({ ...ok, contact_email: "no-es-email" }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...ok, contact_email: "a@b.com" }).success).toBe(true);
  });
});

describe("projectFormSchema", () => {
  const ok = {
    client_id: "c1",
    name: "PAD 58",
    doc_type: "IA" as const,
    province: "Neuquén",
    applicant_cuit: "",
  };
  it("acepta un proyecto mínimo válido", () => {
    expect(projectFormSchema.safeParse(ok).success).toBe(true);
  });
  it("rechaza cliente/provincia vacíos, doc_type desconocido y CUIT malo", () => {
    expect(projectFormSchema.safeParse({ ...ok, client_id: "" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...ok, province: "" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...ok, doc_type: "XX" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...ok, applicant_cuit: "12" }).success).toBe(false);
  });
});
