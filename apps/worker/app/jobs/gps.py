"""Importación de GPS (.gdb de Garmin / .gpx) y cruce con los waypoints del relevamiento. Sin red ni Supabase."""
from __future__ import annotations

import re
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import gpxpy

GDB_MAGIC = b"MsRcf"  # cabecera de Garmin MapSource/BaseCamp (NO es Esri)
GPSBABEL_TIMEOUT_S = 120
Runner = Callable[..., Any]


@dataclass
class GpsPoint:
    name: str | None
    number: int | None
    lat: float
    lon: float
    elevation_m: float | None = None
    recorded_at: str | None = None  # ISO 8601


@dataclass
class MatchResult:
    # (id del waypoint, índice del punto GPS en la lista de puntos)
    pairs: list[tuple[str, int]] = field(default_factory=list)
    unmatched_points: list[str] = field(default_factory=list)      # puntos GPS sin waypoint
    unmatched_waypoints: list[int] = field(default_factory=list)   # waypoints sin punto GPS
    ambiguous: list[int] = field(default_factory=list)             # el mismo N° en varios waypoints: no se asigna
    duplicates: list[int] = field(default_factory=list)            # el mismo N° en varios puntos GPS: se usa el último


def check_signature(path: Path, kind: str) -> str | None:
    """Valida el tipo REAL del archivo por su contenido, no por la extensión (A.10). None = correcto."""
    head = path.read_bytes()[:512]
    if kind == "gdb":
        return None if head.startswith(GDB_MAGIC) else (
            "El archivo no es un .gdb de Garmin (MapSource/BaseCamp): la cabecera 'MsRcf' no coincide.")
    if kind == "gpx":
        text = head.lstrip(b"\xef\xbb\xbf \t\r\n")
        return None if text.startswith((b"<?xml", b"<gpx")) else "El archivo no es un GPX válido."
    return f"Formato de GPS no soportado todavía: {kind}."


def gdb_to_gpx(src: Path, dst: Path, run: Runner = subprocess.run, exe: str | None = None) -> None:
    """gpsbabel -i gdb -f in.gdb -o gpx,gpxver=1.1 -F out.gpx. `run` se inyecta para probar sin el binario."""
    exe = exe or shutil.which("gpsbabel") or "gpsbabel"
    cmd = [exe, "-i", "gdb", "-f", str(src), "-o", "gpx,gpxver=1.1", "-F", str(dst)]
    try:
        r = run(cmd, capture_output=True, text=True, timeout=GPSBABEL_TIMEOUT_S)
    except FileNotFoundError as e:
        raise RuntimeError("GPSBabel no está instalado en la PC del worker (necesario para leer .gdb).") from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError("GPSBabel tardó demasiado en convertir el .gdb.") from e
    if r.returncode != 0:
        detalle = (r.stderr or "").strip().splitlines()[-1:] or ["sin detalle"]
        raise RuntimeError(f"GPSBabel no pudo convertir el .gdb: {detalle[0]}")


def number_from_name(name: str | None) -> int | None:
    """Último grupo de dígitos del nombre: '008' → 8, 'WPT 012' → 12, 'P58-004' → 4. Sin dígitos → None."""
    m = re.findall(r"\d+", name or "")
    return int(m[-1]) if m else None


def parse_gpx(data: bytes | str) -> list[GpsPoint]:
    """Solo waypoints (las trazas/rutas del .gdb no se cruzan)."""
    gpx = gpxpy.parse(data)
    out: list[GpsPoint] = []
    for w in gpx.waypoints:
        ele = w.elevation if w.elevation not in (None, 0) else None  # 0 exacto = sin dato en muchos Garmin
        out.append(GpsPoint(w.name, number_from_name(w.name), w.latitude, w.longitude, ele,
                            w.time.isoformat() if w.time else None))
    return out


def match_waypoints(points: list[GpsPoint], waypoints: list[dict[str, Any]]) -> MatchResult:
    """Cruza por N° de waypoint. `waypoints`: dicts con al menos `id` y `number`."""
    res = MatchResult()

    # un solo punto GPS por número: el más reciente (o el último del archivo si no hay hora)
    best: dict[int, int] = {}
    seen: set[int] = set()
    for i, p in enumerate(points):
        if p.number is None:
            res.unmatched_points.append(p.name or "(sin nombre)")
            continue
        if p.number in best:
            seen.add(p.number)
            prev = points[best[p.number]]
            if (p.recorded_at or "") >= (prev.recorded_at or ""):
                best[p.number] = i
        else:
            best[p.number] = i
    res.duplicates = sorted(seen)

    by_number: dict[int, list[str]] = {}
    for w in waypoints:
        if w.get("number") is not None:
            by_number.setdefault(int(w["number"]), []).append(w["id"])

    for number, idx in sorted(best.items()):
        ids = by_number.get(number, [])
        if not ids:
            res.unmatched_points.append(points[idx].name or str(number))
        elif len(ids) > 1:
            res.ambiguous.append(number)  # varias fichas con el mismo N°: que lo resuelva una persona
        else:
            res.pairs.append((ids[0], idx))

    res.unmatched_waypoints = sorted(n for n in by_number if n not in best and n not in res.ambiguous)
    return res
