"""E/S con Supabase: reclama layer_imports, descarga de Storage, procesa e inserta."""
from __future__ import annotations

import logging
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any

from app.jobs.docs import run_docs_job
from app.jobs.figures import run_figure_job
from app.jobs.gps import check_signature, gdb_to_gpx, match_waypoints, parse_gpx
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


def _fetch_all(query_factory: Any, page: int = 1000) -> list[dict[str, Any]]:
    """PostgREST corta en ~1000 filas: pagina hasta agotar. `query_factory()` devuelve una consulta nueva."""
    rows: list[dict[str, Any]] = []
    while True:
        chunk = query_factory().range(len(rows), len(rows) + page - 1).execute().data or []
        rows += chunk
        if len(chunk) < page:
            return rows


def _point_wkt(lat: float, lon: float) -> str:
    return f"SRID=4326;POINT({lon} {lat})"


def run_gps_job(client: Any, job: dict[str, Any]) -> None:
    """Procesa un gps_import ya reclamado: valida, convierte, guarda puntos y cruza con los waypoints. Nunca lanza."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / Path(job["file_path"]).name
            src.write_bytes(client.storage.from_(BUCKET).download(job["file_path"]))
            if (bad := check_signature(src, job["file_kind"])):
                raise ValueError(bad)
            gpx = src
            if job["file_kind"] == "gdb":
                gpx = Path(tmp) / "convertido.gpx"
                gdb_to_gpx(src, gpx)
            points = parse_gpx(gpx.read_bytes())

        wps = _fetch_all(lambda: client.table("waypoints").select("id, number").eq("project_id", job["project_id"]))
        m = match_waypoints(points, wps)

        ids = [str(uuid.uuid4()) for _ in points]
        rows = [{
            "id": ids[i], "org_id": job["org_id"], "project_id": job["project_id"], "import_id": job["id"],
            "name": p.name, "number": p.number, "geom": _point_wkt(p.lat, p.lon),
            "elevation_m": p.elevation_m, "recorded_at": p.recorded_at,
        } for i, p in enumerate(points)]
        client.table("gps_points").delete().eq("import_id", job["id"]).execute()
        for i in range(0, len(rows), BATCH):
            client.table("gps_points").insert(rows[i:i + BATCH]).execute()

        for wid, idx in m.pairs:
            p = points[idx]
            client.table("waypoints").update({
                "geom": _point_wkt(p.lat, p.lon), "elevation_m": p.elevation_m, "source": "gps",
                "gps_point_id": ids[idx], "matched": True,
            }).eq("id", wid).execute()

        upd: dict[str, Any] = {
            "status": "listo", "n_points": len(points), "n_matched": len(m.pairs),
            "n_unmatched": len(m.unmatched_points), "error": None,
            "report": {"unmatched_points": m.unmatched_points, "unmatched_waypoints": m.unmatched_waypoints,
                       "ambiguous": m.ambiguous, "duplicates": m.duplicates},
        }
    except (ValueError, RuntimeError) as e:  # mensajes pensados para el usuario
        upd = {"status": "error", "error": str(e)}
    except Exception as e:
        log.exception("fallo procesando gps_import %s", job.get("id"))
        upd = {"status": "error", "error": f"Error inesperado al procesar el GPS: {e}"}
    client.table("gps_imports").update(upd).eq("id", job["id"]).execute()


def poll_once(client: Any) -> bool:
    """Reclama y procesa un trabajo (capas primero, luego GPS). True si habia uno."""
    for table, run in (("layer_imports", run_layer_job), ("gps_imports", run_gps_job),
                       ("document_builds", run_docs_job), ("figure_builds", run_figure_job)):
        job = client.rpc("claim_job", {"p_table": table}).execute().data
        if job:
            run(client, job)
            return True
    return False


def poll_forever(client: Any, poll_seconds: float, stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            if poll_once(client):
                continue  # hay mas trabajos: no esperar
        except Exception:
            log.exception("error en el sondeo de trabajos")
        stop.wait(poll_seconds)
