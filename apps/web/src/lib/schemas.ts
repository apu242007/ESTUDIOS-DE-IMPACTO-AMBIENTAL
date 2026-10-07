import { z } from "zod";

// ---------- Filas de la base (se parsean al leer: sin `any`) ----------
export const roleSchema = z.enum(["admin", "miembro"]);
export type Role = z.infer<typeof roleSchema>;

export const docTypes = ["IA", "MTD", "IA+MTD"] as const;
export const docTypeSchema = z.enum(docTypes);

export const contactSchema = z
  .object({
    nombre: z.string().optional(),
    email: z.string().optional(),
    telefono: z.string().optional(),
  })
  .loose();

export const clientRowSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  cuit: z.string().nullable(),
  address: z.string().nullable(),
  contact: contactSchema,
  logo_path: z.string().nullable(),
  created_at: z.string(),
});
export type ClientRow = z.infer<typeof clientRowSchema>;

export const applicantSchema = z
  .object({
    razon_social: z.string().optional(),
    cuit: z.string().optional(),
    domicilio: z.string().optional(),
  })
  .loose();

export const consultantSchema = z
  .object({
    razon_social: z.string().optional(),
    responsable: z.string().optional(),
    matricula: z.string().optional(),
  })
  .loose();

export const projectRowSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  client_id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  short_name: z.string().nullable().optional(),
  zone_key: z.string().nullable().optional(),
  doc_type: docTypeSchema,
  field_area: z.string().nullable(),
  report_date: z.string().nullable().optional(),
  province: z.string(),
  status: z.enum(["borrador", "revision", "entregado", "cerrado"]),
  applicant: applicantSchema,
  consultant: consultantSchema,
  crs_epsg: z.number(),
  // tolerante: un umbral con formato inválido no debe ocultar el proyecto; la pantalla avisa y permite restablecerlo
  thresholds: z.unknown(),
  skipped_steps: z.array(z.string()).optional(), // pasos del recorrido omitidos por un admin (0021)
  archived_at: z.string().nullable().optional(), // archivado (0028): sale de la lista; solo un admin lo devuelve
  created_at: z.string(),
  clients: z.object({ name: z.string() }).nullable().optional(),
});
export type ProjectRow = z.infer<typeof projectRowSchema>;

export const cadastreRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  nomenclature: z.string().nullable(),
  lot: z.string().nullable(),
  owners: z.string().nullable(),
});
export type CadastreRow = z.infer<typeof cadastreRowSchema>;

export const codeRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  meaning: z.string(),
  sort_order: z.number(),
});
export type CodeRow = z.infer<typeof codeRowSchema>;

export const memberRowSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  role: roleSchema,
});
export type MemberRow = z.infer<typeof memberRowSchema>;

export const membershipRowSchema = z.object({
  org_id: z.string(),
  role: roleSchema,
  organizations: z.object({ name: z.string() }).nullable(),
});

// ---------- Formularios ----------
const optionalText = z.string().trim().optional();

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const registerSchema = loginSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export const orgSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre de la organización"),
});

// CUIT: 11 dígitos, con o sin guiones. Se guarda como XX-XXXXXXXX-X.
export function normalizeCuit(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : v;
}
const cuitField = z
  .string()
  .trim()
  .refine((v) => v === "" || v.replace(/\D/g, "").length === 11, "El CUIT debe tener 11 dígitos");

export const clientFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre"),
  cuit: cuitField,
  address: optionalText,
  contact_nombre: optionalText,
  contact_email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email inválido"),
  contact_telefono: optionalText,
});
export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const projectFormSchema = z.object({
  client_id: z.string().min(1, "Elegí un cliente"),
  name: z.string().trim().min(2, "Ingresá el nombre del proyecto"),
  code: optionalText,
  short_name: optionalText,
  doc_type: docTypeSchema,
  field_area: optionalText,
  report_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida").optional(),
  province: z.string().min(1, "Elegí la provincia"),
  applicant_razon_social: optionalText,
  applicant_cuit: cuitField,
  applicant_domicilio: optionalText,
  consultant_razon_social: optionalText,
  consultant_responsable: optionalText,
  consultant_matricula: optionalText,
});
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const cadastreFormSchema = z.object({
  nomenclature: optionalText,
  lot: optionalText,
  owners: optionalText,
});

export const codeFormSchema = z.object({
  code: z.string().trim().min(1, "Ingresá la sigla").max(6, "Máximo 6 caracteres"),
  meaning: z.string().trim().min(2, "Ingresá el significado"),
});

export const memberFormSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  role: roleSchema,
});

export const provinces = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
] as const;

export const emptyToNull = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
