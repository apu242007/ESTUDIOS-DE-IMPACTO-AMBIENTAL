import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { must, parseAll } from "./util";

const BUCKET = "project-files";

export const figureKinds = ["ubicacion", "implantacion", "interferencias", "otra"] as const;
export type FigureKind = (typeof figureKinds)[number];
export const figureKindLabel: Record<FigureKind, string> = {
  ubicacion: "Ubicación general",
  implantacion: "Implantación",
  interferencias: "Interferencias",
  otra: "Otra figura",
};

export const figureBases = ["satelite", "osm"] as const;
export type FigureBase = (typeof figureBases)[number];
export const figureBaseLabel: Record<FigureBase, string> = {
  satelite: "Satelital",
  osm: "Mapa base",
};

export const figureStatuses = ["pendiente", "procesando", "listo", "error"] as const;
export type FigureStatus = (typeof figureStatuses)[number];
export const figureStatusLabel: Record<FigureStatus, string> = {
  pendiente: "En cola",
  procesando: "Generando",
  listo: "Lista",
  error: "Error",
};

export const figureParamsSchema = z.object({
  base: z.enum(figureBases),
  leyenda: z.boolean(),
});
export type FigureParams = z.infer<typeof figureParamsSchema>;

export const figureSchema = z.object({
  id: z.string(),
  kind: z.enum(figureKinds),
  params: figureParamsSchema,
  status: z.enum(figureStatuses),
  file_path: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
});
export type FigureRow = z.infer<typeof figureSchema>;

export async function listFigures(projectId: string): Promise<FigureRow[]> {
  const result = await createClient()
    .from("figure_builds")
    .select("id, kind, params, status, file_path, error, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return parseAll(figureSchema, must(result));
}

export async function createFigure(projectId: string, kind: FigureKind, params: FigureParams): Promise<void> {
  const parsed = figureParamsSchema.parse(params);
  const { error } = await createClient().from("figure_builds").insert({ project_id: projectId, kind, params: parsed });
  if (error) throw new Error(error.message);
}

async function signedUrl(path: string, download?: string): Promise<string> {
  const options = download ? { download } : undefined;
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 300, options);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar el archivo");
  return data.signedUrl;
}

export function previewFigureUrl(path: string): Promise<string> {
  return signedUrl(path);
}

export function downloadFigureUrl(path: string, filename: string): Promise<string> {
  return signedUrl(path, filename);
}
