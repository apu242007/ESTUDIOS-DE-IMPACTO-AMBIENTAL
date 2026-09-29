import shutil
from pathlib import Path
from typing import Any

import pytest
import shapefile
from pyproj import CRS, Transformer
from shapely import wkt

from app.jobs.layers import missing_sidecars, process_layer, process_kml_bytes
from app.jobs.poller import poll_once

FIX = Path(__file__).resolve().parents[3] / "fixtures"
SHP = FIX / "shp"
needs_fixtures = pytest.mark.skipif(not (SHP / "Caminos.shp").exists(), reason="faltan fixtures/shp")


def shp(name: str):
    return process_layer(SHP / f"{name}.shp", "shp")


@needs_fixtures
def test_caminos_cinco_lineas() -> None:
    r = shp("Caminos")
    assert r.status == "listo" and r.crs_detected == "EPSG:22182"
    got = [f.length_m for f in r.features]
    for g, exp in zip(got, [2269, 158, 70, 84, 244]):
        assert g == pytest.approx(exp, abs=1)
    assert r.features[0].name.startswith("Camino troncal")
    assert "Perforación" in r.features[2].name  # tildes bien leidas


@needs_fixtures
def test_pozos_seis_puntos_a_10_m() -> None:
    r = shp("Pozos")
    assert len(r.features) == 6
    to22182 = Transformer.from_crs(4326, 22182, always_xy=True)
    pts = [to22182.transform(*wkt.loads(f.wkt).coords[0]) for f in r.features]
    for a, b in zip(pts, pts[1:]):
        assert ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 == pytest.approx(10, abs=0.5)
    assert all(f.elevation_m is not None for f in r.features)  # Z guardado
    assert "Z" not in r.features[0].wkt.split("(")[0]  # geometria 2D


@needs_fixtures
def test_acueductos() -> None:
    assert shp("Acueducto flexible temporal de agua dulce").features[0].length_m == pytest.approx(10517, abs=1)
    assert shp("Acueducto flexible temporal de agua de producción").features[0].length_m == pytest.approx(19189, abs=1)


@needs_fixtures
def test_rebombeo_un_punto() -> None:
    r = shp("Estación de rebombeo")
    assert len(r.features) == 1 and r.features[0].name == "REB 01"


@needs_fixtures
def test_sin_prj_requiere_crs_y_confirmado_procesa(tmp_path: Path) -> None:
    for e in ("shp", "shx", "dbf"):
        shutil.copy(SHP / f"Pozos.{e}", tmp_path / f"capa.{e}")
    r = process_layer(tmp_path / "capa.shp", "shp")
    assert r.status == "requiere_crs" and "prj" in r.missing and r.error
    ok = process_layer(tmp_path / "capa.shp", "shp", crs_confirmed_epsg=22182)
    assert ok.status in ("listo", "incompleto") and ok.features


@needs_fixtures
def test_sidecars_faltantes_no_rompe(tmp_path: Path) -> None:
    # Caminos sin .shx ni .prj/.dbf en el directorio: solo lista lo que falta
    shutil.copy(SHP / "Caminos.shp", tmp_path / "Caminos.shp")
    assert missing_sidecars(tmp_path / "Caminos.shp") == ["shx", "dbf", "prj"]
    assert missing_sidecars(tmp_path / "noexiste" / "x.shp") == list(("shp", "shx", "dbf", "prj"))
    assert process_layer(tmp_path / "Caminos.shp", "shp").status == "requiere_crs"


def test_shp_sintetico_poligono_multiparte(tmp_path: Path) -> None:
    prj = CRS.from_epsg(22182).to_wkt(version="WKT1_ESRI")
    with shapefile.Writer(str(tmp_path / "p")) as w:
        w.field("Name", "C")
        w.poly([[[0, 0], [0, 100], [100, 100], [100, 0], [0, 0]]])
        w.record("cuadrado")
    with shapefile.Writer(str(tmp_path / "l")) as w:
        w.field("Name", "C")
        w.line([[[0, 0], [0, 10]], [[20, 0], [20, 10]]])
        w.record("dos partes")
    for n in ("p", "l"):
        (tmp_path / f"{n}.prj").write_text(prj)
    a, b = process_layer(tmp_path / "p.shp", "shp"), process_layer(tmp_path / "l.shp", "shp")
    assert a.status == b.status == "listo"
    assert a.features[0].area_m2 == pytest.approx(10000, rel=1e-3)
    assert b.features[0].length_m == pytest.approx(20, abs=0.1)
    assert b.features[0].geojson["type"] == "MultiLineString" and b.features[0].name == "dos partes"


KML = b"""<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>P1</name><Point><coordinates>-68.5,-38.1,300</coordinates></Point></Placemark>
<Placemark><name>L1</name><LineString><coordinates>-68.5,-38.1 -68.5,-38.11</coordinates></LineString></Placemark>
<Placemark><name>A1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
-68.5,-38.1 -68.5,-38.101 -68.499,-38.101 -68.499,-38.1 -68.5,-38.1</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>"""


def test_kml_punto_linea_poligono() -> None:
    r = process_kml_bytes(KML)
    assert [f.name for f in r.features] == ["P1", "L1", "A1"]
    assert r.features[0].elevation_m == 300
    assert r.features[1].length_m == pytest.approx(1110, abs=15)
    assert r.features[2].area_m2 and r.features[2].area_m2 > 5000
    assert process_kml_bytes(b"no es xml").status == "error"


@needs_fixtures
def test_kmz_real() -> None:
    r = process_layer(FIX / "kmz" / "ACUEDUCTOS PAD 58.kmz", "kmz")
    assert r.status == "listo" and r.crs_detected == "EPSG:4326"
    assert r.features[0].length_m == pytest.approx(10517, abs=1)


def test_kmz_corrupto(tmp_path: Path) -> None:
    (tmp_path / "x.kmz").write_bytes(b"basura")
    r = process_layer(tmp_path / "x.kmz", "kmz")
    assert r.status == "error" and "KMZ" in (r.error or "")


class FakeClient:
    """Cliente Supabase minimo para probar el flujo sin red."""

    def __init__(self, job: dict[str, Any]) -> None:
        self.job, self.calls = job, []
        self.storage = self

    def from_(self, _b: str): return self
    def download(self, path: str) -> bytes: return (SHP / Path(path).name).read_bytes()
    def rpc(self, *_a): return self
    def table(self, t: str): self.t = t; return self
    def select(self, *_a): return self
    def eq(self, *_a): return self
    def limit(self, *_a): return self
    def delete(self): return self
    def insert(self, rows): self.calls.append(("insert", self.t, len(rows))); return self
    def update(self, upd): self.calls.append(("update", self.t, upd)); return self

    def execute(self):
        class R: pass
        r = R()
        r.data = self.job if self.calls == [] and self.t is None else []
        return r

    t = None


@needs_fixtures
def test_poll_once_flujo_completo() -> None:
    job = {"id": "i1", "org_id": "o", "project_id": "p", "format": "shp", "crs_confirmed_epsg": None,
           "files": [{"path": f"o/p/shp/Pozos.{e}", "ext": e} for e in ("shp", "shx", "dbf", "prj")]}
    c = FakeClient(job)
    assert poll_once(c) is True
    assert ("insert", "layer_features", 6) in c.calls
    upd = [x for x in c.calls if x[0] == "update"][0][2]
    assert upd["status"] == "listo" and upd["n_features"] == 6 and upd["crs_detected"] == "EPSG:22182"
