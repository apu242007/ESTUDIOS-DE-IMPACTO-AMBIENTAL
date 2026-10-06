"""Carga el proyecto de ejemplo con los datos de fixtures/ (capas SHP, .gdb y fotos) por el mismo camino que la web:
sube a Storage y crea las filas en 'pendiente'; el worker las procesa. Idempotente: saltea lo ya cargado.

Uso (desde apps/worker, con .env completo):  .venv/Scripts/python.exe scripts/load_demo.py <project_id>
"""
import io
import sys
import uuid
from pathlib import Path

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
SIDECARS = ("shp", "shx", "dbf", "prj", "cpg", "qix", "qmd")


def env() -> dict[str, str]:
    lines = (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines()
    return dict(l.split("=", 1) for l in lines if "=" in l and not l.startswith("#"))


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
                path = f"{base}/layers/{iid}/{f.name}"
                bucket.upload(path, f.read_bytes())
                files.append({"path": path, "ext": ext, "size": f.stat().st_size})
        missing = [x for x in ("shx", "dbf", "prj") if not shp.with_suffix(f".{x}").exists()]
        sb.table("layer_imports").insert({"id": iid, "project_id": project_id, "base_name": name, "format": "shp",
                                          "files": files, "missing": missing, "status": "pendiente"}).execute()
        print("capa", name)

    if not sb.table("gps_imports").select("id").eq("project_id", project_id).execute().data:
        for gdb in (FIX / "gps").glob("*.gdb"):
            path = f"{base}/gps/{uuid.uuid4()}/{gdb.name}"
            bucket.upload(path, gdb.read_bytes())
            sb.table("gps_imports").insert({"project_id": project_id, "file_path": path, "file_kind": "gdb",
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
