"""Utilidades de CRS: lectura de .prj y reproyeccion (siempre orden lon/lat)."""
from __future__ import annotations

from collections.abc import Callable

from pyproj import CRS, Transformer
from pyproj.exceptions import CRSError
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

DEFAULT_PROJECT_EPSG = 22182  # POSGAR 94 / Argentina 2 (faja 2)
WGS84 = 4326


def crs_from_prj(prj_text: str) -> CRS | None:
    """Devuelve el CRS del texto .prj (WKT ESRI) o None si no se puede interpretar."""
    try:
        return CRS.from_wkt(prj_text.strip())
    except CRSError:
        return None


def crs_label(crs: CRS) -> str:
    """'EPSG:22182' si se reconoce, si no el nombre del CRS."""
    epsg = crs.to_epsg(min_confidence=70)
    return f"EPSG:{epsg}" if epsg else crs.name


def reprojector(src: CRS | int, dst: CRS | int) -> Callable[[BaseGeometry], BaseGeometry]:
    t = Transformer.from_crs(CRS.from_user_input(src), CRS.from_user_input(dst), always_xy=True)
    return lambda g: transform(t.transform, g)
