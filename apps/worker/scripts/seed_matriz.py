"""Carga los catálogos de la matriz de impactos desde el Excel de la consultora.

Uso (desde apps/worker):
  python scripts/seed_matriz.py --org <uuid> [--xlsx ../../fixtures/excel/2947-26_Matriz_YB.xlsx] [--out seed.sql]
  python scripts/seed_matriz.py --project <uuid> --out matriz.sql   # carga los valores del Excel en un proyecto
  python scripts/seed_matriz.py --verify --out verify.sql     # SQL de comprobación contra la base (no deja datos)

Genera SQL (no se conecta a la base): se ejecuta en el SQL Editor de Supabase. Idempotente por (org, código).
No inventa valores: lo que el Excel no trae queda vacío y se lista en el reporte (stderr).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.matriz import parse_matriz  # noqa: E402
from app.core.matriz_sql import project_impacts_sql, seed_sql, verify_sql  # noqa: E402

DEFAULT_XLSX = Path(__file__).resolve().parents[3] / "fixtures" / "excel" / "2947-26_Matriz_YB.xlsx"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    ap.add_argument("--org", help="UUID de la organización destino")
    ap.add_argument("--project", help="UUID de un proyecto: genera la carga de su matriz con los valores del Excel")
    ap.add_argument("--out", type=Path, help="archivo de salida (por defecto, stdout)")
    ap.add_argument("--verify", action="store_true", help="genera el SQL de comprobación en vez de la carga")
    a = ap.parse_args()

    if not a.xlsx.exists():
        print(f"No existe {a.xlsx}", file=sys.stderr)
        return 1
    if not a.verify and not a.org and not a.project:
        print("Falta --org <uuid> (catálogos) o --project <uuid> (matriz de un proyecto)", file=sys.stderr)
        return 1

    m = parse_matriz(a.xlsx)
    sql = verify_sql(m) if a.verify else project_impacts_sql(m, a.project) if a.project else seed_sql(m, a.org)
    (a.out.write_text(sql, encoding="utf-8") if a.out else sys.stdout.write(sql))

    n_cells = sum(len(f.cells) for f in m.factors)
    print(f"{len(m.actions)} acciones, {len(m.factors)} factores, {n_cells} celdas.", file=sys.stderr)
    print("Reporte (lo que el Excel no trae o requiere criterio):", file=sys.stderr)
    for line in m.report:
        print(f"  - {line}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
