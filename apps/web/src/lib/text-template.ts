/** Variables de las plantillas de texto (A.6.11: sin IA; texto = catálogo + variables). */

export type Vars = Record<string, string | number | null | undefined>;

/**
 * Reemplaza {variables} en textos largos. Conserva saltos de párrafo y espacios.
 * - Variable conocida con valor → el valor.
 * - Variable conocida pero vacía → cadena vacía.
 * - Variable que no existe → se deja tal cual ({x}), a la vista: es un error del catálogo y conviene verlo.
 */
export function fillVars(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m));
}

export type ProjectVars = {
  name: string;
  code: string | null;
  short_name?: string | null;
  field_area: string | null;
  province: string;
  clientName?: string | null;
};

/** Variables que el sistema calcula del proyecto. `pad` cae al nombre completo si no se cargó el nombre corto. */
export function projectVars(p: ProjectVars): Vars {
  return {
    pad: p.short_name?.trim() || p.name,
    proyecto: p.name,
    codigo: p.code ?? "",
    yacimiento: p.field_area ?? "",
    provincia: p.province,
    cliente: p.clientName ?? "",
  };
}

/** Variables sin resolver que quedaron en un texto (para avisar antes de generar el informe). */
export function unresolved(text: string, vars: Vars): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !(k in vars)))];
}
