import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { changed, must, parseAll } from "./util";

export const catalogStages = ["construccion", "perforacion", "complementarias", "operacion", "abandono"] as const;
export const catalogStageLabels: Record<(typeof catalogStages)[number], string> = {
  construccion: "Construcción",
  perforacion: "Perforación y terminación",
  complementarias: "Obras complementarias",
  operacion: "Operación",
  abandono: "Abandono",
};
export const impactAttrs = ["IN", "EX", "MO", "PE", "RV", "SI", "AC", "EF", "PR", "MC"] as const;
export const impactAttrLabels: Record<(typeof impactAttrs)[number], string> = {
  IN: "Intensidad", EX: "Extensión", MO: "Momento", PE: "Persistencia", RV: "Reversibilidad",
  SI: "Sinergia", AC: "Acumulación", EF: "Efecto", PR: "Periodicidad", MC: "Recuperabilidad",
};
export const templateVariables = ["pad", "proyecto", "codigo", "yacimiento", "provincia", "cliente"] as const;

const required = (label: string) => z.string().trim().min(1, `${label} es obligatorio`);
const nullableText = z.preprocess((value) => value === "" ? null : value, z.string().trim().nullable());
const sortOrder = z.number().int().min(0, "El orden no puede ser negativo");
const stage = z.preprocess((value) => value === "" ? null : value, z.enum(catalogStages).nullable());

export const impactActionInputSchema = z.object({
  code: required("El código"), name: required("El nombre"), stage, sort_order: sortOrder,
});
export const impactActionSchema = impactActionInputSchema.extend({ id: z.string() });
export type ImpactAction = z.infer<typeof impactActionSchema>;
export type ImpactActionInput = z.infer<typeof impactActionInputSchema>;

export const impactFactorInputSchema = z.object({
  code: required("El código"),
  name: required("El nombre"),
  medio: z.enum(["fisico", "biotico", "perceptual", "socioeconomico", "cultural"]),
  uip: z.number().min(0, "La UIP no puede ser negativa").nullable(),
  component: nullableText,
  sort_order: sortOrder,
});
export const impactFactorSchema = impactFactorInputSchema.extend({ id: z.string() });
export type ImpactFactor = z.infer<typeof impactFactorSchema>;
export type ImpactFactorInput = z.infer<typeof impactFactorInputSchema>;

export const impactAttrInputSchema = z.object({
  attr: z.enum(impactAttrs), label: required("La etiqueta"), value: z.number(), sort_order: sortOrder,
});
export const impactAttrSchema = impactAttrInputSchema.extend({ id: z.string() });
export type ImpactAttr = z.infer<typeof impactAttrSchema>;
export type ImpactAttrInput = z.infer<typeof impactAttrInputSchema>;

export const categoryInputSchema = z.object({
  label: required("La etiqueta"),
  min_abs: z.number().min(0, "El minimo no puede ser negativo"),
  max_abs: z.number().nullable(),
  applies_to: z.enum(["negativo", "positivo"]),
  sort_order: sortOrder,
}).superRefine((value, ctx) => {
  if (value.max_abs !== null && value.max_abs <= value.min_abs) {
    ctx.addIssue({ code: "custom", path: ["max_abs"], message: "El máximo debe ser mayor que el mínimo" });
  }
});
export const categorySchema = z.object({ id: z.string() }).and(categoryInputSchema);
export type ImpactCategory = z.infer<typeof categorySchema>;
export type ImpactCategoryInput = z.infer<typeof categoryInputSchema>;

export const measureInputSchema = z.object({
  program: required("El programa"), name: required("El nombre"), body: required("La medida"), stage,
  action: nullableText, resource: nullableText, timing: nullableText, responsible: nullableText,
  follow_up: nullableText, general: z.boolean(), sort_order: sortOrder,
});
export const measureSchema = measureInputSchema.extend({ id: z.string() });
export type CatalogMeasure = z.infer<typeof measureSchema>;
export type CatalogMeasureInput = z.infer<typeof measureInputSchema>;

export const textBlockInputSchema = z.object({
  key: required("La clave"),
  scope: z.enum(["interferencia", "declaracion", "resumen", "obra", "seccion", "otro"]),
  title: nullableText,
  template: required("La plantilla"),
  sort_order: sortOrder,
});
export const textBlockSchema = textBlockInputSchema.extend({ id: z.string() });
export type CatalogTextBlock = z.infer<typeof textBlockSchema>;
export type CatalogTextBlockInput = z.infer<typeof textBlockInputSchema>;

export const environmentInputSchema = z.object({
  zone_key: required("La zona"), section: required("La seccion"), label: required("La etiqueta"),
  body: required("La descripcion"), sort_order: sortOrder,
});
export const environmentSchema = environmentInputSchema.extend({ id: z.string() });
export type CatalogEnvironment = z.infer<typeof environmentSchema>;
export type CatalogEnvironmentInput = z.infer<typeof environmentInputSchema>;

type Range = Pick<ImpactCategory, "id" | "label" | "min_abs" | "max_abs" | "applies_to">;

export function findOverlappingRanges(ranges: Range[]): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.applies_to !== b.applies_to) continue;
      const aMax = a.max_abs ?? Number.POSITIVE_INFINITY;
      const bMax = b.max_abs ?? Number.POSITIVE_INFINITY;
      if (a.min_abs < bMax && b.min_abs < aMax) found.push([a.id, b.id]);
    }
  }
  return found;
}

export function sumUip(factors: Array<{ uip: number | null }>): number {
  return factors.reduce((total, factor) => total + (factor.uip ?? 0), 0);
}

export function unknownTemplateVariables(template: string): string[] {
  const allowed = new Set<string>(templateVariables);
  const found = new Set<string>();
  for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
    const variable = match[1].trim();
    if (variable && !allowed.has(variable)) found.add(variable);
  }
  return [...found].sort((a, b) => a.localeCompare(b, "es"));
}

export function catalogErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Error inesperado";
  const lower = message.toLowerCase();
  if (lower.includes("catalog_impact_categories_range_excl") || lower.includes("exclusion constraint")) {
    return "El rango se superpone con otra categoría del mismo signo.";
  }
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Ya existe un registro con esa clave o combinación de valores.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "No tenés permisos para modificar este catálogo.";
  }
  return message;
}

async function listRows<T>(table: string, columns: string, orgId: string, schema: z.ZodType<T>, limit = 2000): Promise<T[]> {
  const response = await createClient().from(table).select(columns).eq("org_id", orgId).order("sort_order").limit(limit);
  return parseAll(schema, must(response));
}

async function createRow<T>(table: string, columns: string, orgId: string, input: object, schema: z.ZodType<T>): Promise<T> {
  const response = await createClient().from(table).insert({ org_id: orgId, ...input }).select(columns).single();
  return schema.parse(must(response));
}

async function updateRow<T>(table: string, columns: string, id: string, input: object, schema: z.ZodType<T>): Promise<T> {
  const response = await createClient().from(table).update(input).eq("id", id).select(columns);
  changed(response);
  return schema.parse(response.data?.[0]);
}

async function deleteRow(table: string, id: string): Promise<void> {
  changed(await createClient().from(table).delete().eq("id", id).select("id"));
}

const actionColumns = "id, code, name, stage, sort_order";
export const listImpactActions = (orgId: string) => listRows("catalog_impact_actions", actionColumns, orgId, impactActionSchema);
export const createImpactAction = (orgId: string, input: ImpactActionInput) => createRow("catalog_impact_actions", actionColumns, orgId, impactActionInputSchema.parse(input), impactActionSchema);
export const updateImpactAction = (id: string, input: ImpactActionInput) => updateRow("catalog_impact_actions", actionColumns, id, impactActionInputSchema.parse(input), impactActionSchema);
export const deleteImpactAction = (id: string) => deleteRow("catalog_impact_actions", id);

const factorColumns = "id, code, name, medio, uip, component, sort_order";
export const listImpactFactors = (orgId: string) => listRows("catalog_impact_factors", factorColumns, orgId, impactFactorSchema);
export const createImpactFactor = (orgId: string, input: ImpactFactorInput) => createRow("catalog_impact_factors", factorColumns, orgId, impactFactorInputSchema.parse(input), impactFactorSchema);
export const updateImpactFactor = (id: string, input: ImpactFactorInput) => updateRow("catalog_impact_factors", factorColumns, id, impactFactorInputSchema.parse(input), impactFactorSchema);
export const deleteImpactFactor = (id: string) => deleteRow("catalog_impact_factors", id);

const attrColumns = "id, attr, label, value, sort_order";
export const listImpactAttrs = (orgId: string) => listRows("catalog_impact_attrs", attrColumns, orgId, impactAttrSchema);
export const createImpactAttr = (orgId: string, input: ImpactAttrInput) => createRow("catalog_impact_attrs", attrColumns, orgId, impactAttrInputSchema.parse(input), impactAttrSchema);
export const updateImpactAttr = (id: string, input: ImpactAttrInput) => updateRow("catalog_impact_attrs", attrColumns, id, impactAttrInputSchema.parse(input), impactAttrSchema);
export const deleteImpactAttr = (id: string) => deleteRow("catalog_impact_attrs", id);

const categoryColumns = "id, label, min_abs, max_abs, applies_to, sort_order";
export const listImpactCategories = (orgId: string) => listRows("catalog_impact_categories", categoryColumns, orgId, categorySchema);
export const createImpactCategory = (orgId: string, input: ImpactCategoryInput) => createRow("catalog_impact_categories", categoryColumns, orgId, categoryInputSchema.parse(input), categorySchema);
export const updateImpactCategory = (id: string, input: ImpactCategoryInput) => updateRow("catalog_impact_categories", categoryColumns, id, categoryInputSchema.parse(input), categorySchema);
export const deleteImpactCategory = (id: string) => deleteRow("catalog_impact_categories", id);

const measureColumns = "id, program, name, body, stage, action, resource, timing, responsible, follow_up, general, sort_order";
export const listCatalogMeasures = (orgId: string) => listRows("catalog_measures", measureColumns, orgId, measureSchema);
export const createCatalogMeasure = (orgId: string, input: CatalogMeasureInput) => createRow("catalog_measures", measureColumns, orgId, measureInputSchema.parse(input), measureSchema);
export const updateCatalogMeasure = (id: string, input: CatalogMeasureInput) => updateRow("catalog_measures", measureColumns, id, measureInputSchema.parse(input), measureSchema);
export const deleteCatalogMeasure = (id: string) => deleteRow("catalog_measures", id);

const textColumns = "id, key, scope, title, template, sort_order";
export const listCatalogTextBlocks = (orgId: string) => listRows("catalog_text_blocks", textColumns, orgId, textBlockSchema);
export const createCatalogTextBlock = (orgId: string, input: CatalogTextBlockInput) => createRow("catalog_text_blocks", textColumns, orgId, textBlockInputSchema.parse(input), textBlockSchema);
export const updateCatalogTextBlock = (id: string, input: CatalogTextBlockInput) => updateRow("catalog_text_blocks", textColumns, id, textBlockInputSchema.parse(input), textBlockSchema);
export const deleteCatalogTextBlock = (id: string) => deleteRow("catalog_text_blocks", id);

const environmentColumns = "id, zone_key, section, label, body, sort_order";
export const listCatalogEnvironment = (orgId: string) => listRows("catalog_environment", environmentColumns, orgId, environmentSchema);
export const createCatalogEnvironment = (orgId: string, input: CatalogEnvironmentInput) => createRow("catalog_environment", environmentColumns, orgId, environmentInputSchema.parse(input), environmentSchema);
export const updateCatalogEnvironment = (id: string, input: CatalogEnvironmentInput) => updateRow("catalog_environment", environmentColumns, id, environmentInputSchema.parse(input), environmentSchema);
export const deleteCatalogEnvironment = (id: string) => deleteRow("catalog_environment", id);
