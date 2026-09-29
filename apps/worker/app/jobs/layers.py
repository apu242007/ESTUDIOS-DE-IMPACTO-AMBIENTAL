"""Procesamiento puro de capas (SHP / KMZ / KML). Sin red ni Supabase."""
from __future__ import annotations

import datetime as dt
import zipfile
from contextlib import ExitStack
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import shapefile  # pyshp
from lxml import etree
from pyproj import CRS
from shapely import force_2d
from shapely.geometry import (
    GeometryCollection, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon,
    mapping, shape,
)
from shapely.geometry.base import BaseGeometry

from app.core.crs import DEFAULT_PROJECT_EPSG, WGS84, crs_from_prj, crs_label, reprojector

SHP_REQUIRED = ("shp", "shx", "dbf", "prj")
NAME_FIELDS = ("name", "nombre")
NODATA_Z = -1e30


@dataclass
class Feature:
    name: str | None
    props: dict[str, Any]
    wkt: str
    geojson: dict[str, Any]
    elevation_m: float | None = None
    length_m: float | None = None
    area_m2: float | None = None


@dataclass
class LayerResult:
    status: str  # listo | requiere_crs | incompleto | error
    features: list[Feature] = field(default_factory=list)
    crs_detected: str | None = None
    missing: list[str] = field(default_factory=list)
    error: str | None = None


def _sidecars(shp_path: Path) -> dict[str, Path]:
    """Archivos hermanos {ext: ruta} con el mismo nombre base (sin distinguir mayusculas)."""
    stem = shp_path.stem.lower()
    return {p.suffix.lower().lstrip("."): p for p in shp_path.parent.iterdir()
            if p.is_file() and p.stem.lower() == stem}


def missing_sidecars(shp_path: Path) -> list[str]:
    """Extensiones SHP que faltan junto a `shp_path`. Nunca lanza."""
    have = _sidecars(shp_path) if shp_path.parent.is_dir() else {}
    return [e for e in SHP_REQUIRED if e not in have]


def _jsonable(v: Any) -> Any:
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace")
    return v


def _make_feature(name: str | None, props: dict[str, Any], geom4326: BaseGeometry,
                  elevation: float | None, to_project: Any) -> Feature:
    geom = force_2d(geom4326)
    g = to_project(geom)
    length = round(g.length, 2) if isinstance(g, (LineString, MultiLineString)) else None
    area = round(g.area, 2) if isinstance(g, (Polygon, MultiPolygon)) else None
    return Feature(name, props, geom.wkt, mapping(geom), elevation, length, area)


def _pick_name(props: dict[str, Any]) -> str | None:
    for k, v in props.items():
        if k.lower() in NAME_FIELDS and v not in (None, ""):
            return str(v).strip()
    return None


def process_shp(shp_path: Path, crs_confirmed_epsg: int | None = None,
                project_epsg: int = DEFAULT_PROJECT_EPSG) -> LayerResult:
    missing = missing_sidecars(shp_path)
    if "shp" in missing:
        return LayerResult("error", missing=missing, error="Falta el archivo .shp de la capa.")

    prj = _sidecars(shp_path).get("prj")
    src: CRS | None = None
    if prj is not None:
        src = crs_from_prj(prj.read_text(encoding="utf-8", errors="replace"))
    if src is None and crs_confirmed_epsg:
        src = CRS.from_epsg(crs_confirmed_epsg)
    if src is None:
        motivo = "no se pudo interpretar el .prj" if prj else "la capa no tiene archivo .prj"
        return LayerResult("requiere_crs", missing=missing,
                           error=f"Falta confirmar el sistema de coordenadas: {motivo}.")

    try:
        cpg = _sidecars(shp_path).get("cpg")
        declared = cpg.read_text(errors="ignore").strip() if cpg else "utf-8"
        try:
            feats = _read_shp(shp_path, src, project_epsg, "dbf" not in missing, declared)
        except UnicodeDecodeError:  # el .cpg miente con frecuencia: reintento en cp1252
            feats = _read_shp(shp_path, src, project_epsg, "dbf" not in missing, "cp1252")
    except Exception as e:  # archivo corrupto, geometria no soportada, etc.
        return LayerResult("error", missing=missing, crs_detected=crs_label(src),
                           error=f"No se pudo leer la capa: {e}")
    # sin .dbf se pierden los atributos (incompleto); sin .shx/.prj solo se informa
    status = "incompleto" if "dbf" in missing else "listo"
    return LayerResult(status, feats, crs_label(src), missing)


def _read_shp(shp_path: Path, src: CRS, project_epsg: int, has_dbf: bool,
              encoding: str) -> list[Feature]:
    to_4326 = reprojector(src, WGS84)
    to_project = reprojector(WGS84, project_epsg)
    out: list[Feature] = []
    sc = _sidecars(shp_path)
    with ExitStack() as stack:
        kw: dict[str, Any] = {
            e: stack.enter_context(open(sc[e], "rb"))
            for e in ("shp", "dbf", "shx") if e in sc and (e != "dbf" or has_dbf)
        }
        sf = stack.enter_context(shapefile.Reader(**kw, encoding=encoding, encodingErrors="strict"))
        fields = [f[0] for f in sf.fields[1:]] if has_dbf else []
        for i, shp in enumerate(sf.iterShapes()):
            if shp.shapeType == shapefile.NULL:
                continue
            rec = sf.record(i) if has_dbf else []
            props = {k: _jsonable(v) for k, v in zip(fields, rec)}
            z = None  # ponytail: solo Z de puntos (POINTZ); lineas/poligonos se aplanan a 2D
            if shp.shapeType == shapefile.POINTZ and len(shp.z) and shp.z[0] > NODATA_Z:
                z = float(shp.z[0])
            geom = to_4326(force_2d(shape(shp.__geo_interface__)))
            out.append(_make_feature(_pick_name(props), props, geom, z, to_project))
    return out


# ---------------------------------------------------------------- KML / KMZ

def _local(el: etree._Element) -> str:
    return etree.QName(el).localname if isinstance(el.tag, str) else ""


def _coords(el: etree._Element) -> list[tuple[float, ...]]:
    node = next((c for c in el.iter() if _local(c) == "coordinates"), None)
    if node is None or not node.text:
        return []
    return [tuple(float(x) for x in t.split(",")) for t in node.text.split()]


def _kml_geoms(pm: etree._Element) -> tuple[list[BaseGeometry], float | None]:
    geoms: list[BaseGeometry] = []
    elev: float | None = None
    for el in pm.iter():
        kind = _local(el)
        if kind == "Point":
            c = _coords(el)
            if c:
                geoms.append(Point(c[0][:2]))
                if len(c[0]) > 2 and c[0][2] != 0:
                    elev = c[0][2]
        elif kind == "LineString":
            geoms.append(LineString([p[:2] for p in _coords(el)]))
        elif kind == "Polygon":
            rings = [[p[:2] for p in _coords(r)] for r in el.iter() if _local(r) == "LinearRing"]
            if rings:
                geoms.append(Polygon(rings[0], rings[1:]))
    return geoms, elev


def _combine(geoms: list[BaseGeometry]) -> BaseGeometry:
    if len(geoms) == 1:
        return geoms[0]
    for cls, multi in ((Point, MultiPoint), (LineString, MultiLineString), (Polygon, MultiPolygon)):
        if all(isinstance(g, cls) for g in geoms):
            return multi(geoms)
    return GeometryCollection(geoms)


def process_kml_bytes(data: bytes, project_epsg: int = DEFAULT_PROJECT_EPSG) -> LayerResult:
    try:
        root = etree.fromstring(data, etree.XMLParser(resolve_entities=False))
    except etree.XMLSyntaxError as e:
        return LayerResult("error", error=f"El archivo KML no es un XML valido: {e}")
    to_project = reprojector(WGS84, project_epsg)
    feats: list[Feature] = []
    try:
        for pm in (e for e in root.iter() if _local(e) == "Placemark"):
            geoms, elev = _kml_geoms(pm)
            if not geoms:
                continue
            name_el = next((c for c in pm if _local(c) == "name"), None)
            name = name_el.text.strip() if name_el is not None and name_el.text else None
            feats.append(_make_feature(name, {}, _combine(geoms), elev, to_project))
    except ValueError as e:
        return LayerResult("error", error=f"Coordenadas invalidas en el KML: {e}")
    if not feats:
        return LayerResult("error", error="El KML/KMZ no contiene puntos, lineas ni poligonos.")
    return LayerResult("listo", feats, f"EPSG:{WGS84}")


def process_kmz(path: Path, project_epsg: int = DEFAULT_PROJECT_EPSG) -> LayerResult:
    try:
        with zipfile.ZipFile(path) as z:
            kmls = [n for n in z.namelist() if n.lower().endswith(".kml")]
            if not kmls:
                return LayerResult("error", error="El KMZ no contiene ningun archivo .kml.")
            name = next((n for n in kmls if n.lower().endswith("doc.kml")), kmls[0])
            return process_kml_bytes(z.read(name), project_epsg)
    except zipfile.BadZipFile:
        return LayerResult("error", error="El KMZ esta danado o no es un archivo ZIP valido.")


def process_layer(path: Path, fmt: str, crs_confirmed_epsg: int | None = None,
                  project_epsg: int = DEFAULT_PROJECT_EPSG) -> LayerResult:
    """Punto de entrada: `path` = .shp / .kmz / .kml principal (sidecars al lado)."""
    if fmt == "shp":
        return process_shp(path, crs_confirmed_epsg, project_epsg)
    if fmt == "kmz":
        return process_kmz(path, project_epsg)
    if fmt == "kml":
        return process_kml_bytes(path.read_bytes(), project_epsg)
    return LayerResult("error", error=f"Formato no soportado en esta etapa: {fmt}.")
