import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { ControlData } from "@/lib/control";
import type { ProjectRow } from "@/lib/schemas";
import { parseThresholds } from "@/lib/threshold";
import { listCodes, listPhotoCategories } from "./catalogs";
import { must, parseAll } from "./util";

const num = z.number().nullable();
const workSchema = z.object({ name: z.string(), declared_length_m: num, declared_area_m2: num, geom_length_m: num, geom_area_m2: num });
const layerSchema = z.object({ base_name: z.string(), status: z.string() });
const lineSchema = z.object({ ficha_no: num, closed: z.boolean() });
const wpSchema = z.object({ number: num, code: z.string().nullable(), lat: num, lon: num, matched: z.boolean(), source: z.string() });
const photoSchema = z.object({ category: z.string().nullable(), caption: z.string().nullable() });
const centerSchema = z.object({ lon: z.number(), lat: z.number() });

/** Reúne todo lo que las reglas de control necesitan, con consultas livianas. */
export async function loadControlData(orgId: string, project: ProjectRow): Promise<ControlData> {
  const sb = createClient();
  const pid = project.id;
  const head = { count: "exact" as const, head: true };
  const [works, layers, lines, wps, photos, center, impacts, measures, figures, finals, blocks, overrides, factors, cats, codes] = await Promise.all([
    sb.from("works_compare").select("name, declared_length_m, declared_area_m2, geom_length_m, geom_area_m2").eq("project_id", pid).order("sort_order"),
    sb.from("layer_imports").select("base_name, status").eq("project_id", pid),
    sb.from("survey_lines").select("ficha_no, closed").eq("project_id", pid),
    sb.from("waypoints_view").select("number, code, lat, lon, matched, source").eq("project_id", pid).limit(5000),
    sb.from("photos").select("category, caption").eq("project_id", pid).limit(5000),
    sb.rpc("project_center", { p_project: pid }),
    sb.from("project_impacts").select("id", head).eq("project_id", pid),
    sb.from("project_measures").select("id", head).eq("project_id", pid),
    sb.from("figure_builds").select("kind").eq("project_id", pid).eq("status", "listo"),
    sb.from("document_builds").select("id").eq("project_id", pid).eq("status", "listo").eq("params->>final", "true").limit(1),
    sb.from("catalog_text_blocks").select("key").eq("org_id", orgId).eq("scope", "declaracion"),
    sb.from("project_declarations").select("factor_id").eq("project_id", pid),
    sb.from("catalog_impact_factors").select("id, code, name").eq("org_id", orgId).order("sort_order"),
    listPhotoCategories(orgId),
    listCodes(orgId),
  ]);
  for (const r of [impacts, measures]) if (r.error) throw new Error(r.error.message);

  const withBlock = new Set((must(blocks) as { key: string }[]).map((b) => b.key));
  const withOverride = new Set((must(overrides) as { factor_id: string }[]).map((o) => o.factor_id));
  const c = parseAll(centerSchema, (must(center) as unknown[]) ?? [])[0] ?? null;

  return {
    project: {
      name: project.name,
      code: project.code,
      clientName: project.clients?.name ?? null,
      applicant: project.applicant.razon_social ?? null,
      consultant: project.consultant.razon_social ?? null,
    },
    thresholds: parseThresholds(project.thresholds),
    works: parseAll(workSchema, must(works)).map((w) => ({ name: w.name, declaredLength: w.declared_length_m, declaredArea: w.declared_area_m2, geomLength: w.geom_length_m, geomArea: w.geom_area_m2 })),
    layers: parseAll(layerSchema, must(layers)).map((l) => ({ name: l.base_name, status: l.status })),
    lines: parseAll(lineSchema, must(lines)).map((l) => ({ ficha: l.ficha_no, closed: l.closed })),
    waypoints: parseAll(wpSchema, must(wps)),
    photos: parseAll(photoSchema, must(photos)),
    photoCategoryKeys: cats.map((k) => k.key),
    codes: codes.map((k) => k.code),
    center: c,
    impacts: impacts.count ?? 0,
    factorsWithoutDeclaration: (must(factors) as { id: string; code: string; name: string }[])
      .filter((f) => !withBlock.has(`decl_${f.code}`) && !withOverride.has(f.id))
      .map((f) => f.name),
    zoneKey: project.zone_key ?? null,
    measuresSelected: measures.count ?? 0,
    figureKinds: [...new Set((must(figures) as { kind: string }[]).map((f) => f.kind))],
    hasFinalBuild: ((must(finals) as unknown[]) ?? []).length > 0,
  };
}
