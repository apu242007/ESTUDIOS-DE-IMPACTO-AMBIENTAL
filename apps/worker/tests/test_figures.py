import io
from types import SimpleNamespace
from typing import Any

import pytest
from PIL import Image

from app.jobs import poller
from app.jobs.figures import render_figure, run_figure_job


def figure_data() -> dict[str, Any]:
    return {
        "layers": [
            {
                "work_id": "w1",
                "name": "Traza principal",
                "geojson": {
                    "type": "LineString",
                    "coordinates": [[-68.57, -38.13], [-68.55, -38.12]],
                },
            },
            {
                "work_id": "w2",
                "name": "Predio",
                "geojson": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-68.565, -38.135], [-68.555, -38.135],
                        [-68.555, -38.125], [-68.565, -38.125], [-68.565, -38.135],
                    ]],
                },
            },
        ],
        "works": [
            {"id": "w1", "name": "Camino", "kind": "camino"},
            {"id": "w2", "name": "Locación", "kind": "locacion"},
        ],
        "wells": [{"name": "Pozo LC-101", "geojson": {"type": "Point", "coordinates": [-68.56, -38.13]}}],
        "waypoints": [
            {"number": 4, "code": "CR", "lat": -38.129, "lon": -68.558, "line_id": "l1"},
            {"number": 5, "code": "AF", "lat": -38.128, "lon": -68.557, "line_id": "l1"},
        ],
        "catalog": {"CR": "Cruce", "AF": "Afloramiento"},
    }


@pytest.mark.parametrize("kind", ["ubicacion", "implantacion", "interferencias"])
def test_render_figure_es_png_valido(kind: str) -> None:
    calls: list[str] = []

    def tiles(ax: Any, base: str) -> None:
        calls.append(base)
        ax.set_facecolor("#eeeeee")

    png = render_figure(kind, figure_data(), {"base": "osm", "leyenda": True}, fetch_tiles=tiles)

    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    with Image.open(io.BytesIO(png)) as image:
        assert image.format == "PNG"
        assert image.width >= 1400 and image.height >= 900
    assert calls == ["osm"]


def test_render_sin_datos_da_error_legible() -> None:
    with pytest.raises(ValueError, match="No hay capas ni pozos para dibujar"):
        render_figure("ubicacion", {"layers": [], "works": [], "wells": [], "waypoints": [], "catalog": {}}, {})


def test_render_sigue_si_fallan_las_teselas(caplog: pytest.LogCaptureFixture) -> None:
    def fallen_tiles(_ax: Any, _base: str) -> None:
        raise OSError("sin conexión")

    png = render_figure("implantacion", figure_data(), {"base": "satelite", "leyenda": False}, fetch_tiles=fallen_tiles)

    assert png.startswith(b"\x89PNG")
    assert "No se pudo cargar el mapa base" in caplog.text


class FakeClient:
    def __init__(self, tables: dict[str, list[dict[str, Any]]]) -> None:
        self.tables = tables
        self.storage = self
        self.uploads: dict[str, tuple[bytes, dict[str, str]]] = {}
        self.updates: list[tuple[str, dict[str, Any], str]] = []
        self._table = ""
        self._filters: dict[str, Any] = {}
        self._update: dict[str, Any] | None = None
        self._range: tuple[int, int] | None = None

    def from_(self, _bucket: str) -> "FakeClient":
        return self

    def upload(self, path: str, data: bytes, options: dict[str, str]) -> None:
        self.uploads[path] = (data, options)

    def table(self, name: str) -> "FakeClient":
        self._table, self._filters, self._update, self._range = name, {}, None, None
        return self

    def select(self, _columns: str) -> "FakeClient":
        return self

    def eq(self, column: str, value: Any) -> "FakeClient":
        self._filters[column] = value
        if self._update is not None:
            self.updates.append((self._table, self._update, str(value)))
        return self

    def range(self, start: int, end: int) -> "FakeClient":
        self._range = (start, end)
        return self

    def update(self, values: dict[str, Any]) -> "FakeClient":
        self._update = values
        return self

    def execute(self) -> SimpleNamespace:
        if self._update is not None:
            return SimpleNamespace(data=[])
        rows = [
            row for row in self.tables.get(self._table, [])
            if all(row.get(column) == value for column, value in self._filters.items())
        ]
        if self._range is not None:
            rows = rows[self._range[0]:self._range[1] + 1]
        return SimpleNamespace(data=rows)


def job() -> dict[str, Any]:
    return {
        "id": "f1", "org_id": "o1", "project_id": "p1", "kind": "implantacion",
        "params": {"base": "osm", "leyenda": True},
    }


def fake_tables() -> dict[str, list[dict[str, Any]]]:
    data = figure_data()
    return {
        "layer_features_geojson": [{**row, "project_id": "p1"} for row in data["layers"]],
        "wells_geojson": [{**row, "project_id": "p1"} for row in data["wells"]],
        "waypoints_view": [{**row, "project_id": "p1"} for row in data["waypoints"]],
        "catalog_codes": [
            {"org_id": "o1", "code": code, "meaning": meaning} for code, meaning in data["catalog"].items()
        ],
        "works": [{**row, "project_id": "p1"} for row in data["works"]],
    }


def test_run_figure_job_carga_sube_y_actualiza(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.jobs.figures._default_fetch_tiles", lambda ax, base: None)
    client = FakeClient(fake_tables())

    run_figure_job(client, job())

    path = "o1/p1/figures/f1.png"
    assert client.uploads[path][0].startswith(b"\x89PNG")
    assert client.uploads[path][1] == {"content-type": "image/png", "upsert": "true"}
    table, update, row_id = client.updates[-1]
    assert (table, row_id) == ("figure_builds", "f1")
    assert update == {"status": "listo", "file_path": path, "error": None}


def test_run_figure_job_sin_datos_no_lanza_y_marca_error() -> None:
    client = FakeClient({})

    run_figure_job(client, job())

    assert not client.uploads
    assert client.updates[-1][1]["status"] == "error"
    assert client.updates[-1][1]["error"] == "No hay capas ni pozos para dibujar"


def test_poller_reclama_figure_builds(monkeypatch: pytest.MonkeyPatch) -> None:
    claimed = job()
    seen: list[tuple[str, str]] = []

    class ClaimClient:
        table_name = ""

        def rpc(self, _name: str, args: dict[str, Any]) -> "ClaimClient":
            self.table_name = args["p_table"]
            return self

        def execute(self) -> SimpleNamespace:
            return SimpleNamespace(data=claimed if self.table_name == "figure_builds" else None)

    monkeypatch.setattr(poller, "run_figure_job", lambda _client, value: seen.append(("figure_builds", value["id"])))

    assert poller.poll_once(ClaimClient()) is True
    assert seen == [("figure_builds", "f1")]


def test_carga_de_datos_pagina_las_capas_grandes() -> None:
    """Una capa con más de 1000 elementos no debe quedar truncada al dibujar."""
    from app.jobs.figures import _load_data

    feats = [{"project_id": "p1", "work_id": None, "name": f"f{i}", "geojson": {"type": "Point", "coordinates": [-68.5, -38.1]}} for i in range(2500)]
    data = _load_data(FakeClient({"layer_features_geojson": feats}), job())
    assert len(data["layers"]) == 2500


def test_las_teselas_se_piden_identificando_la_aplicacion(monkeypatch: pytest.MonkeyPatch) -> None:
    """OSM bloquea el User-Agent por defecto de contextily: se debe fijar uno propio antes de pedir teselas."""
    import contextily as cx
    import contextily.tile as cx_tile

    from app.jobs import figures

    visto: dict[str, str] = {}

    def falso(ax: Any, source: Any = None, **kw: Any) -> None:
        visto["ua"] = cx_tile.USER_AGENT

    monkeypatch.setattr(cx, "add_basemap", falso)
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()
    try:
        figures._default_fetch_tiles(ax, "osm")
    finally:
        plt.close(fig)
    assert visto["ua"] == figures.TILE_USER_AGENT
    assert not visto["ua"].startswith("contextily-")


def test_las_etiquetas_de_pozos_muy_juntos_no_se_pisan() -> None:
    """Seis pozos a 10 m entre sí (caso PAD 58): cada etiqueta va en una posición distinta de la columna de llamadas."""
    from matplotlib.text import Annotation

    import matplotlib.pyplot as plt

    from app.jobs import figures

    capturadas: list[Any] = []
    original = plt.Axes.annotate

    def espia(self: Any, *a: Any, **k: Any) -> Any:
        r = original(self, *a, **k)
        if isinstance(r, Annotation):
            capturadas.append(k.get("xytext"))
        return r

    wells = [{"name": f"POZO-{2581 + i}", "geojson": {"type": "Point", "coordinates": [-68.57, -38.13 - i * 0.00009]}} for i in range(6)]
    plt.Axes.annotate = espia  # type: ignore[method-assign]
    try:
        figures.render_figure("implantacion", {"layers": [], "wells": wells, "waypoints": [], "catalog": {}, "works": []},
                              {"leyenda": True}, fetch_tiles=lambda ax, base: None)
    finally:
        plt.Axes.annotate = original  # type: ignore[method-assign]
    desplazamientos = [c[1] for c in capturadas if c is not None]
    assert len(desplazamientos) >= 6 and len(set(desplazamientos[:6])) == 6
