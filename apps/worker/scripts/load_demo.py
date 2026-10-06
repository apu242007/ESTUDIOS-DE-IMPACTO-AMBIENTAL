"""Carga el proyecto de ejemplo con los datos de fixtures/ (capas SHP, .gdb y fotos) por el mismo camino que la web:
sube a Storage y crea las filas en 'pendiente'; el worker las procesa. Idempotente: saltea lo ya cargado.

Uso (desde apps/worker, con .env completo):  .venv/Scripts/python.exe scripts/load_demo.py <project_id>
"""
import io
import json
import re
import sys
import unicodedata
import uuid
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps
from supabase import create_client

ROOT = Path(__file__).resolve().parents[3]
FIX = ROOT / "fixtures"
FOTOS = ROOT / "Doc en trabajo-20260929T143532Z-1-001" / "Doc en trabajo" / "Relevamiento" / "Fotografias"
# carpeta de fotos del relevamiento -> clave de catalog_photo_categories
CATEGORIAS = {
    "Acueductos flexibles": "acueductos_flexibles",
    "Camino ingreso alternativo": "camino_ingreso_secundario",
    "Caminos más lineas troncal": "camino_troncal",
    "Cmino de egreso": "camino_egreso_fractura",
    "Ductos de evaacuación": "ductos",
    "Locación más pozos": "locacion",
    "Predio interconexion PAD 58": "predio_interconexion",
    "T1": "transecta_1",
    "T2": "transecta_2",
}
def storage_name(name: str) -> str:
    """Igual que storageName de la web: Storage rechaza tildes y ñ en la clave."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^\w .()-]", "_", s)


SIDECARS = ("shp", "shx", "dbf", "prj", "cpg", "qix", "qmd")


def env() -> dict[str, str]:
    lines = (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines()
    return dict(l.split("=", 1) for l in lines if "=" in l and not l.startswith("#"))


def _date(s: str | None) -> str | None:
    m = re.match(r"(\d{1,2})\D(\d{1,2})", s or "")
    return f"2026-{int(m[2]):02d}-{int(m[1]):02d}" if m else None  # las planillas no traen año


def load_fichas(sb: Any, org: str, project_id: str) -> None:
    """Fichas transcriptas de las planillas de papel (fixtures/relevamiento.json). Páginas de una misma ficha = una línea."""
    src = FIX / "relevamiento.json"
    if not src.exists() or sb.table("survey_lines").select("id").eq("project_id", project_id).limit(1).execute().data:
        return
    groups: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for f in json.loads(src.read_text(encoding="utf-8"))["fichas"]:
        if f["image"] == "DSCN7716.JPG":  # foto anterior de la misma hoja que DSCN7952
            continue
        form = "loc" if (f.get("tipo") or "").startswith("Locaciones") else "lin"
        groups.setdefault((form, f["ficha_no"]), []).append(f)
    seen: set[int] = set()
    for (form, ficha_no), pages in groups.items():
        h = pages[0]
        lid = str(uuid.uuid4())
        headings = [r["description"] for pg in pages for r in pg["rows"] if r.get("heading")]
        doubtful = [r["description"] for pg in pages for r in pg["rows"] if r.get("doubtful")]
        notes = "Transcripta de planilla en papel (" + ", ".join(pg["image"] for pg in pages) + ")."
        if headings:
            notes += " Tramos: " + "; ".join(headings) + "."
        if doubtful:
            notes += " Revisar lectura dudosa: " + "; ".join(doubtful) + "."
        sb.table("survey_lines").insert({
            "id": lid, "org_id": org, "project_id": project_id, "ficha_no": ficha_no,
            "kind": (h.get("tipo") or "").replace(" (pág. 2)", "") or None, "start_label": h.get("inicio"), "end_label": h.get("fin"),
            "survey_date": _date(h.get("fecha")), "company": h.get("empresa"), "notes": notes}).execute()
        order = 0
        for pg in pages:
            for r in pg["rows"]:
                if r.get("heading"):
                    continue
                nums = r.get("waypoints") or [r.get("waypoint")]
                views = (r.get("views") or "").split("|")
                for i, n in enumerate(nums):
                    if n in seen:  # número repetido en la planilla: no se adivina, queda sin número
                        n = None
                    if n is not None:
                        seen.add(n)
                    desc = r["description"] + (" (lectura dudosa)" if r.get("doubtful") else "")
                    sb.table("waypoints").insert({
                        "id": str(uuid.uuid4()), "org_id": org, "project_id": project_id, "line_id": lid, "number": n,
                        "code": r.get("code"), "description": desc, "views": (views[i] if i < len(views) else views[0]) or None,
                        "source": "manual", "sort_order": order}).execute()
                    order += 1
        print("ficha", form, ficha_no, order, "waypoints")


def main(project_id: str) -> None:
    e = env()
    sb = create_client(e["SUPABASE_URL"], e["SUPABASE_SERVICE_ROLE_KEY"])
    bucket = sb.storage.from_(e.get("STORAGE_BUCKET") or "project-files")
    org = sb.table("projects").select("org_id").eq("id", project_id).single().execute().data["org_id"]
    base = f"{org}/{project_id}"

    done = {r["base_name"] for r in sb.table("layer_imports").select("base_name").eq("project_id", project_id).execute().data}
    for shp in sorted((FIX / "shp").glob("*.shp")):
        name = shp.stem
        if name in done:
            continue
        iid = str(uuid.uuid4())
        files = []
        for ext in SIDECARS:
            f = shp.with_suffix(f".{ext}")
            if f.exists():
                path = f"{base}/layers/{iid}/{storage_name(f.name)}"
                bucket.upload(path, f.read_bytes())
                files.append({"path": path, "ext": ext, "size": f.stat().st_size})
        missing = [x for x in ("shx", "dbf", "prj") if not shp.with_suffix(f".{x}").exists()]
        sb.table("layer_imports").insert({"id": iid, "project_id": project_id, "base_name": name, "format": "shp",
                                          "files": files, "missing": missing, "status": "pendiente"}).execute()
        print("capa", name)

    load_fichas(sb, org, project_id)

    # sin GPSBabel no se lee el .gdb: se usa el GPX exportado de los mismos waypoints si existe
    gps_files = sorted((FIX / "gps").glob("*.gpx")) or sorted((FIX / "gps").glob("*.gdb"))
    if not sb.table("gps_imports").select("id").eq("project_id", project_id).neq("status", "error").execute().data:
        for gdb in gps_files[:1]:
            path = f"{base}/gps/{uuid.uuid4()}/{storage_name(gdb.name)}"
            bucket.upload(path, gdb.read_bytes())
            sb.table("gps_imports").insert({"project_id": project_id, "file_path": path, "file_kind": gdb.suffix[1:],
                                            "status": "pendiente"}).execute()
            print("gps", gdb.name)

    if not sb.table("photos").select("id").eq("project_id", project_id).limit(1).execute().data:
        n = 0
        for folder, cat in CATEGORIAS.items():
            for i, jpg in enumerate(sorted((FOTOS / folder).glob("*.[jJ][pP]*[gG]"))):
                # misma compresión que la web: lado mayor 1920 px, JPEG ~80
                img = ImageOps.exif_transpose(Image.open(jpg)).convert("RGB")
                img.thumbnail((1920, 1920))
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=80)
                pid = str(uuid.uuid4())
                path = f"{base}/photos/{pid}.jpg"
                bucket.upload(path, buf.getvalue(), {"content-type": "image/jpeg"})
                sb.table("photos").insert({"id": pid, "org_id": org, "project_id": project_id, "category": cat,
                                           "path_original": path, "sort_order": i}).execute()
                n += 1
        print("fotos", n)


if __name__ == "__main__":
    main(sys.argv[1])
