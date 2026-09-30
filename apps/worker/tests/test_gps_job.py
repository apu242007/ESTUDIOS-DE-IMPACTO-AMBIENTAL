from typing import Any

import pytest

from app.jobs import gps
from app.jobs.poller import poll_once, run_gps_job

GPX = b"""<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
<wpt lat="-38.129939" lon="-68.568602"><ele>138</ele><name>004</name></wpt>
<wpt lat="-38.13" lon="-68.57"><name>005</name></wpt>
<wpt lat="-38.14" lon="-68.58"><name>099</name></wpt></gpx>"""


class FakeClient:
    def __init__(self, blob: bytes, waypoints: list[dict[str, Any]], claim: dict[str, Any] | None = None) -> None:
        self.blob, self.waypoints, self.claim = blob, waypoints, claim
        self.inserts: list[tuple[str, list[dict[str, Any]]]] = []
        self.updates: list[tuple[str, dict[str, Any], str]] = []
        self.storage = self
        self._t = ""
        self._pending: dict[str, Any] | None = None

    # storage
    def from_(self, _b: str): return self
    def download(self, _p: str) -> bytes: return self.blob

    # rpc / tabla encadenable
    def rpc(self, _n: str, args: dict[str, Any]):
        self._t = "rpc:" + args["p_table"]
        return self

    def table(self, t: str): self._t, self._pending = t, None; return self
    def select(self, *_a): return self
    def eq(self, _c: str, v: Any):
        if self._pending is not None:
            self.updates.append((self._t, self._pending, v))
            self._pending = None
        return self
    def range(self, a: int, _b: int): self._r = a; return self
    def delete(self): return self
    def insert(self, rows): self.inserts.append((self._t, rows)); return self
    def update(self, upd): self._pending = upd; return self

    def execute(self):
        class R: pass
        r = R()
        if self._t == "rpc:gps_imports": r.data = self.claim
        elif self._t.startswith("rpc:"): r.data = None
        elif self._t == "waypoints": r.data = self.waypoints if getattr(self, "_r", 0) == 0 else []
        else: r.data = []
        return r


def job(kind: str = "gpx") -> dict[str, Any]:
    return {"id": "g1", "org_id": "o", "project_id": "p", "file_path": f"o/p/gps/x.{kind}", "file_kind": kind}


def final_update(c: FakeClient) -> dict[str, Any]:
    return [u for t, u, i in c.updates if t == "gps_imports" and i == "g1"][-1]


def test_gpx_cruza_actualiza_waypoints_y_reporta() -> None:
    c = FakeClient(GPX, [{"id": "w4", "number": 4}, {"id": "w5", "number": 5}, {"id": "w6", "number": 6}])
    run_gps_job(c, job())
    pts = [rows for t, rows in c.inserts if t == "gps_points"][0]
    assert len(pts) == 3 and pts[0]["geom"] == "SRID=4326;POINT(-68.568602 -38.129939)"  # lon primero
    wp = {i: u for t, u, i in c.updates if t == "waypoints"}
    assert set(wp) == {"w4", "w5"}
    assert wp["w4"]["source"] == "gps" and wp["w4"]["matched"] is True and wp["w4"]["elevation_m"] == 138
    f = final_update(c)
    assert f["status"] == "listo" and (f["n_points"], f["n_matched"], f["n_unmatched"]) == (3, 2, 1)
    assert f["report"]["unmatched_points"] == ["099"] and f["report"]["unmatched_waypoints"] == [6]


def test_firma_invalida_deja_error_legible_y_no_toca_waypoints() -> None:
    c = FakeClient(b"PK\x03\x04 zip renombrado", [{"id": "w4", "number": 4}])
    run_gps_job(c, job("gdb"))
    f = final_update(c)
    assert f["status"] == "error" and "MsRcf" in f["error"]
    assert not [u for t, u, _ in c.updates if t == "waypoints"] and not c.inserts


def test_gdb_sin_gpsbabel_da_mensaje_claro(monkeypatch: pytest.MonkeyPatch) -> None:
    def sin_binario(*a, **k): raise FileNotFoundError

    monkeypatch.setattr(gps.subprocess, "run", sin_binario)
    c = FakeClient(gps.GDB_MAGIC + b"\x00" * 64, [{"id": "w4", "number": 4}])
    run_gps_job(c, job("gdb"))
    f = final_update(c)
    assert f["status"] == "error" and "GPSBabel no está instalado" in f["error"]


def test_poll_once_toma_gps_cuando_no_hay_capas() -> None:
    c = FakeClient(GPX, [{"id": "w4", "number": 4}], claim=job())
    assert poll_once(c) is True
    assert final_update(c)["status"] == "listo"
    assert FakeClient(GPX, [], claim=None) and poll_once(FakeClient(GPX, [], claim=None)) is False
