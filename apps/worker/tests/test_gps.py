from pathlib import Path
from types import SimpleNamespace

import pytest

from app.jobs.gps import (
    GDB_MAGIC, GpsPoint, check_signature, gdb_to_gpx, match_waypoints, number_from_name, parse_gpx,
)

GPX = """<?xml version="1.0"?>
<gpx version="1.1" creator="GPSBabel" xmlns="http://www.topografix.com/GPX/1/1">
<wpt lat="-38.129939" lon="-68.568602"><ele>138.4</ele><time>2026-03-10T14:00:00Z</time><name>004</name></wpt>
<wpt lat="-38.13" lon="-68.57"><ele>0</ele><name>WPT 005</name></wpt>
<wpt lat="-38.14" lon="-68.58"><name>SIN NUMERO</name></wpt>
<trk><name>traza</name><trkseg><trkpt lat="-38.1" lon="-68.5"/></trkseg></trk>
</gpx>"""


@pytest.mark.parametrize("nombre,esperado", [("008", 8), ("WPT 012", 12), ("P58-004", 4), ("CR001", 1), ("ABC", None), (None, None)])
def test_numero_desde_nombre(nombre, esperado) -> None:
    assert number_from_name(nombre) == esperado


def test_parse_gpx_solo_waypoints() -> None:
    pts = parse_gpx(GPX)
    assert [p.number for p in pts] == [4, 5, None]  # la traza no se importa
    assert pts[0].elevation_m == pytest.approx(138.4)
    assert pts[0].recorded_at and pts[0].recorded_at.startswith("2026-03-10")
    assert pts[1].elevation_m is None  # ele=0 se toma como sin dato


def test_firma_gdb(tmp_path: Path) -> None:
    ok, mal = tmp_path / "a.gdb", tmp_path / "b.gdb"
    ok.write_bytes(GDB_MAGIC + b"\x00" * 40)
    mal.write_bytes(b"PK\x03\x04 esto es un zip renombrado")
    assert check_signature(ok, "gdb") is None
    assert "MsRcf" in (check_signature(mal, "gdb") or "")
    g = tmp_path / "c.gpx"
    g.write_bytes(b"\xef\xbb\xbf<?xml version='1.0'?><gpx/>")
    assert check_signature(g, "gpx") is None
    assert check_signature(mal, "gpx")
    assert "no soportado" in (check_signature(ok, "kmz") or "")


def test_gdb_to_gpx_arma_el_comando_correcto(tmp_path: Path) -> None:
    visto = {}

    def run(cmd, **kw):
        visto["cmd"] = cmd
        return SimpleNamespace(returncode=0, stderr="")

    gdb_to_gpx(tmp_path / "in.gdb", tmp_path / "out.gpx", run=run, exe="gpsbabel")
    assert visto["cmd"] == ["gpsbabel", "-i", "gdb", "-f", str(tmp_path / "in.gdb"),
                            "-o", "gpx,gpxver=1.1", "-F", str(tmp_path / "out.gpx")]


def test_gdb_to_gpx_errores_legibles(tmp_path: Path) -> None:
    def falta(*a, **k): raise FileNotFoundError

    def falla(*a, **k): return SimpleNamespace(returncode=1, stderr="x\nUnknown option")

    with pytest.raises(RuntimeError, match="no está instalado"):
        gdb_to_gpx(tmp_path / "a", tmp_path / "b", run=falta, exe="gpsbabel")
    with pytest.raises(RuntimeError, match="Unknown option"):
        gdb_to_gpx(tmp_path / "a", tmp_path / "b", run=falla, exe="gpsbabel")


def P(name, lat=-38.1, lon=-68.5, t=None) -> GpsPoint:
    return GpsPoint(name, number_from_name(name), lat, lon, None, t)


def test_cruce_basico_y_sobrantes() -> None:
    pts = [P("004"), P("005"), P("099"), P("SIN NUMERO")]
    wps = [{"id": "w4", "number": 4}, {"id": "w5", "number": 5}, {"id": "w6", "number": 6}]
    r = match_waypoints(pts, wps)
    assert r.pairs == [("w4", 0), ("w5", 1)]
    assert sorted(r.unmatched_points) == ["099", "SIN NUMERO"]
    assert r.unmatched_waypoints == [6]


def test_punto_duplicado_usa_el_mas_reciente() -> None:
    pts = [P("004", t="2026-03-10T10:00:00+00:00"), P("004", lat=-38.2, t="2026-03-10T15:00:00+00:00")]
    r = match_waypoints(pts, [{"id": "w4", "number": 4}])
    assert r.pairs == [("w4", 1)] and r.duplicates == [4]


def test_numero_repetido_en_varias_fichas_es_ambiguo_y_no_se_asigna() -> None:
    r = match_waypoints([P("004")], [{"id": "a", "number": 4}, {"id": "b", "number": 4}])
    assert r.pairs == [] and r.ambiguous == [4]
    assert r.unmatched_waypoints == []


def test_waypoints_sin_numero_se_ignoran() -> None:
    r = match_waypoints([P("004")], [{"id": "x", "number": None}])
    assert r.pairs == [] and r.unmatched_points == ["004"]
