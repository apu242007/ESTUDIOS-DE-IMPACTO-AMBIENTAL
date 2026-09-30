"""Generación determinística de figuras cartográficas para el informe."""
from __future__ import annotations

import io
import logging
from collections.abc import Callable
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.axes import Axes
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from pyproj import Transformer
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

log = logging.getLogger("eia.worker")
BUCKET = "project-files"
PROJECT_CRS = "EPSG:22182"
TileFetcher = Callable[[Axes, str], None]

TITLES = {
    "ubicacion": "Ubicación general del proyecto",
    "implantacion": "Implantación de las obras",
    "interferencias": "Interferencias relevadas",
    "otra": "Figura del proyecto",
}
WORK_COLORS = {
    "locacion": "#d97706",
    "camino": "#7c3aed",
    "ducto": "#dc2626",
    "acueducto_temporal": "#0284c7",
    "linea_electrica": "#ca8a04",
    "fibra_optica": "#0891b2",
    "predio": "#16a34a",
    "apendice": "#9333ea",
    "instalacion_aux": "#64748b",
    "pozo_area": "#ea580c",
}
WORK_LABELS = {
    "locacion": "Locación", "camino": "Camino", "ducto": "Ducto",
    "acueducto_temporal": "Acueducto temporal", "linea_electrica": "Línea eléctrica",
    "fibra_optica": "Fibra óptica", "predio": "Predio", "apendice": "Apéndice",
    "instalacion_aux": "Instalación auxiliar", "pozo_area": "Pozo / área de pozo",
}


# La política de uso de las teselas de OpenStreetMap exige identificar la aplicación. contextily manda por defecto un
# User-Agent aleatorio ("contextily-<uuid>") y OSM lo bloquea: devuelve un PNG "403 Access blocked" que igual se dibuja.
TILE_USER_AGENT = "eia-worker/1.0 (informes ambientales; uso interno de la consultora)"


def _default_fetch_tiles(ax: Axes, base: str) -> None:
    import contextily as cx
    import contextily.tile as cx_tile

    cx_tile.USER_AGENT = TILE_USER_AGENT
    source = cx.providers.Esri.WorldImagery if base == "satelite" else cx.providers.OpenStreetMap.Mapnik
    cx.add_basemap(ax, source=source, crs=PROJECT_CRS, attribution_size=6)


def _geometry(raw: Any, transformer: Transformer) -> BaseGeometry | None:
    try:
        value = raw.get("geometry") if isinstance(raw, dict) and raw.get("type") == "Feature" else raw
        geom = shape(value)
        if geom.is_empty:
            return None
        return transform(transformer.transform, geom)
    except (AttributeError, KeyError, TypeError, ValueError):
        return None


def _point(lon: Any, lat: Any, transformer: Transformer) -> tuple[float, float] | None:
    try:
        return transformer.transform(float(lon), float(lat))
    except (TypeError, ValueError):
        return None


def _draw_geometry(ax: Axes, geom: BaseGeometry, color: str, *, muted: bool = False) -> None:
    alpha = 0.38 if muted else 0.82
    width = 1.6 if muted else 2.5
    if geom.geom_type == "Point":
        ax.scatter([geom.x], [geom.y], s=35, c=color, edgecolors="white", linewidths=0.8, zorder=4, alpha=alpha)
    elif geom.geom_type in ("LineString", "LinearRing"):
        x, y = geom.xy
        ax.plot(x, y, color=color, linewidth=width, alpha=alpha, zorder=3)
    elif geom.geom_type == "Polygon":
        x, y = geom.exterior.xy
        ax.fill(x, y, facecolor=color, edgecolor=color, linewidth=width, alpha=0.22 if not muted else 0.12, zorder=2)
    elif hasattr(geom, "geoms"):
        for part in geom.geoms:
            _draw_geometry(ax, part, color, muted=muted)


def _bounds(geometries: list[BaseGeometry], points: list[tuple[float, float]], broad: bool) -> tuple[float, float, float, float]:
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    for geom in geometries:
        min_x, min_y, max_x, max_y = geom.bounds
        xs.extend((min_x, max_x))
        ys.extend((min_y, max_y))
    if not xs:
        raise ValueError("No hay capas ni pozos para dibujar")
    width = max(max(xs) - min(xs), 500.0)
    height = max(max(ys) - min(ys), 500.0)
    pad = 0.45 if broad else 0.15
    return min(xs) - width * pad, max(xs) + width * pad, min(ys) - height * pad, max(ys) + height * pad


def _scale_bar(ax: Axes) -> None:
    x0, x1 = ax.get_xlim()
    y0, y1 = ax.get_ylim()
    target = (x1 - x0) / 5
    candidates = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
    length = min(candidates, key=lambda candidate: abs(candidate - target))
    start_x, start_y = x0 + (x1 - x0) * 0.06, y0 + (y1 - y0) * 0.06
    ax.plot([start_x, start_x + length], [start_y, start_y], color="black", linewidth=4, zorder=10)
    ax.plot([start_x, start_x + length], [start_y, start_y], color="white", linewidth=2, zorder=11)
    label = f"{length // 1000} km" if length >= 1000 and length % 1000 == 0 else f"{length} m"
    ax.text(start_x + length / 2, start_y + (y1 - y0) * 0.018, label, ha="center", va="bottom",
            fontsize=8, color="black", bbox={"facecolor": "white", "alpha": 0.75, "edgecolor": "none", "pad": 1})


def _north(ax: Axes) -> None:
    ax.annotate("N", xy=(0.94, 0.91), xytext=(0.94, 0.78), xycoords="axes fraction", textcoords="axes fraction",
                ha="center", va="center", fontsize=13, fontweight="bold",
                arrowprops={"facecolor": "black", "edgecolor": "white", "width": 4, "headwidth": 12}, zorder=12)


def render_figure(kind: str, data: dict[str, Any], params: dict[str, Any] | None,
                  fetch_tiles: TileFetcher | None = None) -> bytes:
    """Renderiza una figura PNG a 200 dpi. La carga de teselas es inyectable para pruebas."""
    if kind not in TITLES:
        raise ValueError(f"Tipo de figura no soportado: {kind}")
    params = params or {}
    fetch_tiles = fetch_tiles or _default_fetch_tiles
    transformer = Transformer.from_crs("EPSG:4326", PROJECT_CRS, always_xy=True)
    works = {str(row.get("id")): row for row in data.get("works", [])}
    layer_items: list[tuple[dict[str, Any], BaseGeometry]] = []
    for row in data.get("layers", []):
        geom = _geometry(row.get("geojson"), transformer)
        if geom is not None:
            layer_items.append((row, geom))
    well_items: list[tuple[dict[str, Any], BaseGeometry]] = []
    for row in data.get("wells", []):
        geom = _geometry(row.get("geojson"), transformer)
        if geom is not None:
            well_items.append((row, geom))
    waypoint_items = [(row, point) for row in data.get("waypoints", [])
                      if (point := _point(row.get("lon"), row.get("lat"), transformer)) is not None]

    display_geometries = [geom for _, geom in layer_items + well_items]
    display_points = [point for _, point in waypoint_items] if kind == "interferencias" else []
    extent = _bounds(display_geometries, display_points, kind == "ubicacion")

    fig, ax = plt.subplots(figsize=(8.5, 6))
    try:
        ax.set_xlim(extent[0], extent[1])
        ax.set_ylim(extent[2], extent[3])
        ax.set_facecolor("#eef1ed")
        try:
            fetch_tiles(ax, str(params.get("base") or "osm"))
        except Exception as error:
            log.warning("No se pudo cargar el mapa base; se usa fondo liso: %s", error)

        legend: dict[str, Any] = {}
        if kind == "ubicacion":
            for _, geom in layer_items:
                _draw_geometry(ax, geom, "#dc2626")
            for _, geom in well_items:
                _draw_geometry(ax, geom, "#111827")
            legend["Área del proyecto"] = Patch(facecolor="#dc2626", edgecolor="#dc2626", alpha=0.4)
        elif kind in ("implantacion", "otra"):
            for row, geom in layer_items:
                work = works.get(str(row.get("work_id")), {})
                work_kind = str(work.get("kind") or "otra")
                color = WORK_COLORS.get(work_kind, "#475569")
                _draw_geometry(ax, geom, color)
                legend.setdefault(WORK_LABELS.get(work_kind, work.get("name") or row.get("name") or "Otra obra"),
                                  Line2D([0], [0], color=color, linewidth=3))
            # los pozos de un PAD están a ~10 m entre sí: sus nombres van en una columna de llamadas dentro del recuadro
            # (coordenadas relativas al mapa, nunca se salen ni pisan el título), unidas al pozo por una línea guía
            for i, (row, geom) in enumerate(well_items):
                _draw_geometry(ax, geom, "#111827")
                if geom.geom_type == "Point":
                    ax.annotate(str(row.get("name") or "Pozo"), (geom.x, geom.y), xytext=(0.52, 0.90 - 0.045 * i),
                                textcoords="axes fraction", fontsize=8, fontweight="bold",
                                bbox={"facecolor": "white", "alpha": 0.85, "edgecolor": "none", "pad": 1.5},
                                arrowprops={"arrowstyle": "-", "linewidth": 0.6, "color": "#111827"})
                legend.setdefault("Pozos", Line2D([0], [0], marker="o", color="none", markerfacecolor="#111827",
                                                   markeredgecolor="white", markersize=7))
        else:
            for _, geom in layer_items + well_items:
                _draw_geometry(ax, geom, "#64748b", muted=True)
            catalog = data.get("catalog", {})
            for row, (x, y) in waypoint_items:
                code = str(row.get("code") or "Sin sigla")
                ax.scatter([x], [y], s=55, c="#dc2626", edgecolors="white", linewidths=1, zorder=6)
                ax.annotate(str(row.get("number") or "—"), (x, y), xytext=(5, 5), textcoords="offset points",
                            fontsize=9, fontweight="bold", zorder=7,
                            bbox={"facecolor": "white", "alpha": 0.8, "edgecolor": "none", "pad": 1})
                legend.setdefault(f"{code}: {catalog.get(code, 'Sin descripción')}",
                                  Line2D([0], [0], marker="o", color="none", markerfacecolor="#dc2626", markersize=7))

        ax.set_title(TITLES[kind], fontsize=14, fontweight="bold", pad=12)
        ax.set_xlabel("Este (m) — POSGAR 94 / Argentina 2")
        ax.set_ylabel("Norte (m)")
        ax.ticklabel_format(style="plain", axis="both", useOffset=False)
        ax.grid(color="white", linewidth=0.6, alpha=0.65)
        _north(ax)
        _scale_bar(ax)
        if bool(params.get("leyenda", True)) and legend:
            ax.legend(legend.values(), legend.keys(), loc="lower right", fontsize=8, framealpha=0.9)
        fig.tight_layout()
        output = io.BytesIO()
        fig.savefig(output, format="png", dpi=200, facecolor="white")
        return output.getvalue()
    finally:
        plt.close(fig)


def _load_data(client: Any, job: dict[str, Any]) -> dict[str, Any]:
    project_id = job["project_id"]
    org_id = job["org_id"]

    def rows(table: str, columns: str, key: str, value: str, page: int = 1000) -> list[dict[str, Any]]:
        # PostgREST corta cada respuesta (~1000 filas): se pagina para no dibujar capas grandes a medias
        out: list[dict[str, Any]] = []
        while True:
            chunk = client.table(table).select(columns).eq(key, value).range(len(out), len(out) + page - 1).execute().data or []
            out += chunk
            if len(chunk) < page:
                return out

    catalog_rows = rows("catalog_codes", "code, meaning", "org_id", org_id)
    return {
        "layers": rows("layer_features_geojson", "work_id, name, geojson", "project_id", project_id),
        "wells": rows("wells_geojson", "name, geojson", "project_id", project_id),
        "waypoints": rows("waypoints_view", "number, code, lat, lon, line_id", "project_id", project_id),
        "catalog": {row["code"]: row["meaning"] for row in catalog_rows if row.get("code")},
        "works": rows("works", "id, name, kind", "project_id", project_id),
    }


def run_figure_job(client: Any, job: dict[str, Any]) -> None:
    """Procesa un figure_build reclamado y siempre traduce el resultado a estado de fila."""
    try:
        data = _load_data(client, job)
        png = render_figure(str(job.get("kind") or "otra"), data, job.get("params"))
        path = f"{job['org_id']}/{job['project_id']}/figures/{job['id']}.png"
        client.storage.from_(BUCKET).upload(path, png, {"content-type": "image/png", "upsert": "true"})
        update = {"status": "listo", "file_path": path, "error": None}
    except (ValueError, RuntimeError) as error:
        update = {"status": "error", "file_path": None, "error": str(error)}
    except Exception as error:
        log.exception("fallo generando figure_build %s", job.get("id"))
        update = {"status": "error", "file_path": None,
                  "error": f"Error inesperado al generar la figura: {error}"}
    try:
        client.table("figure_builds").update(update).eq("id", job["id"]).execute()
    except Exception:
        log.exception("no se pudo actualizar figure_build %s", job.get("id"))
