"""E/S con Supabase: reclama layer_imports, descarga de Storage, procesa e inserta."""
from __future__ import annotations

import logging
import tempfile
import threading
from pathlib import Path
from typing import Any

from app.jobs.layers import LayerResult, process_layer

log = logging.getLogger("eia.worker")
BUCKET = "project-files"
BATCH = 500
MAIN_EXT = {"shp": "shp", "kmz": "kmz", "kml": "kml"}


def _project_epsg(client: Any, project_id: str) -> int:
    from app.core.crs import DEFAULT_PROJECT_EPSG
    try:
        r = client.table("projects").select("*").eq("id", project_id).limit(1).execute()
        row = (r.data or [{}])[0]
        return int(row.get("epsg") or row.get("crs_epsg") or DEFAULT_PROJECT_EPSG)
    except Exception:  # la columna puede no existir: se usa el EPSG por defecto
        return DEFAULT_PROJECT_EPSG


def _feature_row(job: dict[str, Any], f: Any) -> dict[str, Any]:
    return {
        "org_id": job["org_id"], "project_id": job["project_id"], "import_id": job["id"],
        "name": f.name, "props": f.props, "geom": f"SRID=4326;{f.wkt}",
        "elevation_m": f.elevation_m, "length_m": f.length_m, "area_m2": f.area_m2,
    }


def run_layer_job(client: Any, job: dict[str, Any]) -> None:
    """Procesa un layer_import ya reclamado (status 'procesando'). Nunca lanza."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            main: Path | None = None
            for f in job.get("files") or []:
                dest = Path(tmp) / Path(f["path"]).name
                dest.write_bytes(client.storage.from_(BUCKET).download(f["path"]))
                if f.get("ext", "").lower().lstrip(".") == MAIN_EXT.get(job["format"]):
                    main = dest
            if main is None:
                res = LayerResult("error", error="No se encontro el archivo principal de la capa.")
            else:
                res = process_layer(main, job["format"], job.get("crs_confirmed_epsg"),
                                    _project_epsg(client, job["project_id"]))
        if res.features:
            rows = [_feature_row(job, f) for f in res.features]
            client.table("layer_features").delete().eq("import_id", job["id"]).execute()
            for i in range(0, len(rows), BATCH):
                client.table("layer_features").insert(rows[i:i + BATCH]).execute()
        upd = {"status": res.status, "crs_detected": res.crs_detected, "n_features": len(res.features),
               "missing": res.missing or job.get("missing") or [], "error": res.error}
    except Exception as e:
        log.exception("fallo procesando layer_import %s", job.get("id"))
        upd = {"status": "error", "error": f"Error inesperado al procesar la capa: {e}"}
    client.table("layer_imports").update(upd).eq("id", job["id"]).execute()


def poll_once(client: Any) -> bool:
    """Reclama y procesa un trabajo. True si habia uno."""
    job = client.rpc("claim_job", {"p_table": "layer_imports"}).execute().data
    if not job:
        return False
    run_layer_job(client, job)
    return True


def poll_forever(client: Any, poll_seconds: float, stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            if poll_once(client):
                continue  # hay mas trabajos: no esperar
        except Exception:
            log.exception("error en el sondeo de trabajos")
        stop.wait(poll_seconds)
