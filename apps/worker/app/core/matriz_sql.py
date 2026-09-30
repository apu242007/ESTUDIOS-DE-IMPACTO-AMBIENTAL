"""SQL de carga de los catálogos de la matriz y de verificación contra la base. Sin red."""
from __future__ import annotations

from app.core.matriz import ATTRS, ATTR_NAMES, Matriz, attr_options


def q(v: object) -> str:
    """Literal SQL. Solo para datos del Excel de la consultora (script de administración, no entrada de usuarios)."""
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def codes(m: Matriz) -> tuple[dict[tuple[str, str], str], dict[str, str]]:
    """Códigos estables por orden de aparición: A01… para acciones, F01… para factores."""
    return ({a: f"A{i:02d}" for i, a in enumerate(m.actions, 1)}, {f.name: f"F{i:02d}" for i, f in enumerate(m.factors, 1)})


def seed_sql(m: Matriz, org: str) -> str:
    """Upsert por (org, código). Idempotente: correrlo dos veces deja lo mismo."""
    ac, fc = codes(m)
    out = ["-- Catálogos de la matriz de impactos (generado por scripts/seed_matriz.py). Idempotente."]

    rows = [f"({q(org)}, {q(ac[a])}, {q(a[1])}, {q(a[0])}, {i})" for i, a in enumerate(m.actions, 1)]
    out.append("insert into public.catalog_impact_actions(org_id, code, name, stage, sort_order) values\n  "
               + ",\n  ".join(rows)
               + "\non conflict (org_id, code) do update set name = excluded.name, stage = excluded.stage, sort_order = excluded.sort_order;")

    rows = [f"({q(org)}, {q(fc[f.name])}, {q(f.name)}, {q(f.medio)}, {q(f.uip)}, {q(f.component or None)}, {i})"
            for i, f in enumerate(m.factors, 1)]
    out.append("insert into public.catalog_impact_factors(org_id, code, name, medio, uip, component, sort_order) values\n  "
               + ",\n  ".join(rows)
               + "\non conflict (org_id, code) do update set name = excluded.name, medio = excluded.medio, uip = excluded.uip,"
                 " component = excluded.component, sort_order = excluded.sort_order;")

    rows = []
    for a, values in attr_options(m).items():
        rows += [f"({q(org)}, {q(a)}, {q(str(v))}, {v}, {i})" for i, v in enumerate(values, 1)]
    out.append("insert into public.catalog_impact_attrs(org_id, attr, label, value, sort_order) values\n  "
               + ",\n  ".join(rows)
               + "\non conflict (org_id, attr, label) do update set value = excluded.value, sort_order = excluded.sort_order;")

    rows = [f"({q(org)}, {q(c['label'])}, {c['min_abs']}, {q(c['max_abs'])}, {q(c['applies_to'])}, {i})"
            for i, c in enumerate(m.categories, 1)]
    out.append("insert into public.catalog_impact_categories(org_id, label, min_abs, max_abs, applies_to, sort_order) values\n  "
               + ",\n  ".join(rows)
               + "\non conflict (org_id, label) do update set min_abs = excluded.min_abs, max_abs = excluded.max_abs,"
                 " applies_to = excluded.applies_to, sort_order = excluded.sort_order;")
    return "\n".join(out) + "\n"


def project_impacts_sql(m: Matriz, project: str) -> str:
    """Carga en un proyecto los signos y valores reales del Excel (la org sale del proyecto). Requiere los catálogos
    ya sembrados (seed_sql). Idempotente: pisa las celdas existentes."""
    ac, fc = codes(m)

    def attrs_json(a: dict[str, int]) -> str:
        return "{" + ",".join(f'"{k}":{v}' for k, v in a.items()) + "}"

    vals = ",\n  ".join(
        f"({q(fc[f.name])}, {q(ac[(c.stage, c.action)])}, {c.sign}, '{attrs_json(c.attrs)}'::jsonb)"
        for f in m.factors for c in f.cells)
    return (
        "-- Matriz de impactos del proyecto (valores del Excel). Requiere los catálogos sembrados. Idempotente.\n"
        "insert into public.project_impacts(project_id, action_id, factor_id, sign, attrs)\n"
        f"select p.id, a.id, f.id, v.sign, v.attrs\n  from (values\n  {vals}\n  ) as v(fcode, acode, sign, attrs)\n"
        f"  join public.projects p on p.id = {q(project)}\n"
        "  join public.catalog_impact_actions a on a.org_id = p.org_id and a.code = v.acode\n"
        "  join public.catalog_impact_factors f on f.org_id = p.org_id and f.code = v.fcode\n"
        "on conflict (project_id, action_id, factor_id) do update set sign = excluded.sign, attrs = excluded.attrs;\n"
    )


def verify_sql(m: Matriz) -> str:
    """Bloque DO que crea todo en una organización temporal, inserta las celdas reales en project_impacts y compara
    importancia con la del Excel. Termina en excepción MATRIZ_RESULT: no deja nada en la base."""
    ac, fc = codes(m)
    cells = [(f, c) for f in m.factors for c in f.cells]

    def attrs_json(a: dict[str, int]) -> str:
        return "{" + ",".join(f'"{k}":{v}' for k, v in a.items()) + "}"

    vals = ",\n    ".join(
        f"({q(fc[f.name])}, {q(ac[(c.stage, c.action)])}, {c.sign}, '{attrs_json(c.attrs)}'::jsonb, {c.excel_i})" for f, c in cells)
    seed = seed_sql(m, "00000000-0000-0000-0000-000000000000")
    seed = seed.replace("'00000000-0000-0000-0000-000000000000'", "o")  # la org real la trae la variable `o`
    return f"""do $$
declare o uuid; cl uuid; p uuid; bad text := ''; n int := 0; nbad int := 0; r record; imp numeric; cat text;
begin
  insert into public.organizations(name) values ('verificacion') returning id into o;
  insert into public.clients(org_id, name) values (o, 'c') returning id into cl;
  insert into public.projects(org_id, client_id, name) values (o, cl, 'p') returning id into p;
  {seed.replace(chr(10), chr(10) + "  ")}
  for r in select * from (values
    {vals}
  ) as t(fcode, acode, sign, attrs, excel_i) loop
    insert into public.project_impacts(project_id, action_id, factor_id, sign, attrs)
    select p, a.id, f.id, r.sign, r.attrs
      from public.catalog_impact_actions a, public.catalog_impact_factors f
     where a.org_id = o and a.code = r.acode and f.org_id = o and f.code = r.fcode
    returning importance, category into imp, cat;
    n := n + 1;
    if imp is distinct from r.excel_i::numeric then
      nbad := nbad + 1;
      bad := bad || format(E'  celda %s/%s: base=%s excel=%s\\n', r.fcode, r.acode, imp, r.excel_i);
    end if;
  end loop;
  raise exception E'MATRIZ_RESULT: % celdas, % con diferencia\\n%', n, nbad, bad;
end $$;
"""
