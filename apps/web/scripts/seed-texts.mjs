// Siembra los catálogos de texto (declaraciones, secciones, ambiente, PGA) desde el JSON que deja
// apps/worker/scripts/extract_ia.py. Entra como un usuario ADMIN de la organización (RLS: no usa service role).
//
//   EIA_EMAIL=... EIA_PASS=... node scripts/seed-texts.mjs --json ../../fixtures/extract/ia58.json \
//       --org <uuid> --zone bajada_del_palo_oeste --pad "PAD 58" [--dry]
//
// Idempotente: declaraciones y secciones se actualizan por clave; ambiente y PGA se reemplazan (falla si algún proyecto
// ya seleccionó medidas, para no perder selecciones). No inventa: lo que no puede vincular lo lista al final.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dry = process.argv.includes("--dry");
const jsonPath = arg("json"), org = arg("org"), zone = arg("zone"), pad = arg("pad");
if (!jsonPath || !org || !zone) { console.error("Faltan --json, --org y --zone"); process.exit(1); }

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, "../.env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: e0 } = await sb.auth.signInWithPassword({ email: process.env.EIA_EMAIL, password: process.env.EIA_PASS });
if (e0) { console.error("No se pudo iniciar sesión:", e0.message); process.exit(1); }

const data = JSON.parse(readFileSync(resolve(jsonPath), "utf8"));
const norm = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70);
const padRe = pad ? new RegExp(pad.replace(/\s+/g, "\\s?"), "g") : null;
const tpl = (t) => (padRe ? t.replace(padRe, "{pad}") : t);   // el nombre del proyecto de origen pasa a variable {pad}

const must = (r, what) => { if (r.error) { console.error(`${what}: ${r.error.message}`); process.exit(1); } return r.data; };
const chunk = (a, n = 40) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

// --- factores de la organización: clasificar por palabras clave (determinista)
const factors = must(await sb.from("catalog_impact_factors").select("id, code, name").eq("org_id", org).order("sort_order"), "factores");
if (factors.length === 0) { console.error("La organización no tiene factores: cargá primero la matriz (seed_matriz.py)."); process.exit(1); }
const RULES = [
  ["subterr", "F05"], ["suministro", "F06"], ["aire", "F01"], ["drenaje", "F04"], ["relieve", "F03"], ["topograf", "F03"],
  ["suelo", "F02"], ["vegetal", "F07"], ["vegetacion", "F07"], ["fauna", "F08"], ["habitat", "F08"], ["pautas", "F08"],
  ["visual", "F09"], ["paisaj", "F09"], ["arqueolog", "F10"], ["paleontolog", "F10"], ["patrimonio", "F10"],
  ["poblacion", "F12"], ["economic", "F13"], ["ocupacion", "F13"], ["infraestructura", "F11"], ["instalaciones", "F11"],
];
const byCode = new Map(factors.map((f) => [f.code, f]));
const factorOf = (text) => { const n = norm(text); const r = RULES.find(([k]) => n.includes(k)); return r ? byCode.get(r[1]) : undefined; };
const sinVincular = [];

// --- 1) declaraciones (una por factor) y secciones narrativas
const blocks = [];
for (const d of data.declarations) {
  const f = factorOf(d.heading);
  if (!f) { sinVincular.push(`declaración: ${d.heading}`); continue; }
  blocks.push({ org_id: org, key: `decl_${f.code}`, scope: "declaracion", title: d.heading, template: tpl(d.paragraphs.join("\n\n")), sort_order: Number(f.code.slice(1)) });
}
data.sections.forEach((s, i) => blocks.push({ org_id: org, key: `sec_${slug(s.path)}`, scope: "seccion", title: s.path, template: tpl(s.paragraphs.join("\n\n")), sort_order: i + 1 }));
const seen = new Set();
const uniq = blocks.filter((b) => (seen.has(b.key) ? false : seen.add(b.key)));   // claves repetidas (mismo título): queda la primera

// --- 2) ambiente por zona
const env2 = data.environment.map((e, i) => ({ org_id: org, zone_key: zone, section: e.section, label: e.label, body: tpl(e.body), sort_order: i + 1 }));

// --- 3) PGA: generales + particulares, vinculadas a factores por el "recurso afectado"
const measures = [
  ...data.pga_general.map((t, i) => ({ program: "Medidas generales", name: t.slice(0, 80), body: tpl(t), general: true, sort_order: i + 1 })),
  ...data.pga_particular.map((m, i) => ({
    program: m.action || "Sin acción", name: (m.action || m.measure).slice(0, 80), body: tpl(m.measure), action: m.action || null,
    resource: m.resource || null, timing: m.timing || null, responsible: m.responsible || null, follow_up: m.follow_up || null,
    stage: stageOf(m.stage), general: false, sort_order: 100 + i,
  })),
];
function stageOf(s) {
  const n = norm(s);
  return n.startsWith("construc") ? "construccion" : n.startsWith("perfora") ? "perforacion" : n.startsWith("obras") ? "complementarias" : n.startsWith("operac") ? "operacion" : n.startsWith("abandon") ? "abandono" : null;
}
const stageDesconocida = measures.filter((m) => !m.general && !m.stage).length;

console.log(`Declaraciones+secciones: ${uniq.length} | ambiente: ${env2.length} | medidas: ${measures.length} (${data.pga_general.length} generales)`);
if (dry) { console.log("--dry: no se escribió nada"); process.exit(0); }

for (const c of chunk(uniq)) must(await sb.from("catalog_text_blocks").upsert(c, { onConflict: "org_id,key" }), "textos");

must(await sb.from("catalog_environment").delete().eq("org_id", org).eq("zone_key", zone), "ambiente (borrar)");
for (const c of chunk(env2)) must(await sb.from("catalog_environment").insert(c), "ambiente");

const usadas = await sb.from("project_measures").select("id", { count: "exact", head: true }).eq("org_id", org);
if (usadas.error) { console.error(`selecciones: ${usadas.error.message}`); process.exit(1); }
if ((usadas.count ?? 0) > 0) { console.error("Hay proyectos con medidas seleccionadas: no se reemplaza el PGA."); process.exit(1); }
must(await sb.from("catalog_measures").delete().eq("org_id", org), "PGA (borrar)");
const inserted = [];
for (const c of chunk(measures)) inserted.push(...must(await sb.from("catalog_measures").insert(c.map((m) => ({ ...m, org_id: org }))).select("id, resource, general"), "PGA"));

const links = [];
for (const m of inserted) {
  if (m.general || !m.resource) continue;
  const fs = new Set();
  for (const tok of m.resource.split("/")) {
    if (norm(tok).trim() === "todos") { factors.forEach((f) => fs.add(f.id)); continue; }   // "Todos": aplica a todos los factores
    const f = factorOf(tok);
    if (f) fs.add(f.id); else if (tok.trim()) sinVincular.push(`recurso: ${tok.trim()}`);
  }
  for (const fid of fs) links.push({ org_id: org, measure_id: m.id, factor_id: fid });
}
for (const c of chunk(links, 100)) must(await sb.from("catalog_measure_factors").upsert(c, { onConflict: "measure_id,factor_id" }), "medida↔factor");

console.log(`Listo: ${uniq.length} textos, ${env2.length} apartados de ambiente, ${inserted.length} medidas, ${links.length} vínculos medida↔factor.`);
if (stageDesconocida) console.log(`Medidas sin etapa reconocida: ${stageDesconocida}`);
const rep = [...new Set(sinVincular)];
if (rep.length) { console.log("Sin vincular a un factor (revisar en el catálogo):"); rep.forEach((r) => console.log("  -", r)); }
