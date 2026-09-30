"""Extrae de un IA real (.docx) los textos para los catálogos y los deja en un JSON local para revisar.

Uso (desde apps/worker):
  python scripts/extract_ia.py "<ruta al IA .docx>" --out ../../fixtures/extract/ia66.json

El JSON queda en fixtures/ (no se versiona: son textos del cliente). Después se siembra con apps/web/scripts/seed-texts.mjs.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.ia_extract import extract_ia  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("docx", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    if not a.docx.exists():
        print(f"No existe {a.docx}", file=sys.stderr)
        return 1
    e = extract_ia(a.docx)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(dataclasses.asdict(e), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{e.source}: {len(e.pga_general)} medidas generales, {len(e.pga_particular)} particulares, "
          f"{len(e.environment)} apartados de ambiente, {len(e.declarations)} declaraciones, {len(e.sections)} secciones.")
    for line in e.report:
        print(f"  - {line}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
