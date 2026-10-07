from typing import Any

from app.jobs.poller import JOB_TABLES, requeue_orphans


class Rec:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any], tuple[str, Any]]] = []

    def table(self, t: str) -> "Rec":
        self._t = t
        return self

    def update(self, u: dict[str, Any]) -> "Rec":
        self._u = u
        return self

    def eq(self, k: str, v: Any) -> "Rec":
        self.calls.append((self._t, self._u, (k, v)))
        return self

    def execute(self) -> None:
        return None


def test_al_arrancar_vuelve_a_la_cola_lo_que_quedo_procesando() -> None:
    c = Rec()
    requeue_orphans(c)
    assert c.calls == [(t, {"status": "pendiente"}, ("status", "procesando")) for t in JOB_TABLES]


# --- Seguridad: el worker usa service role (salta RLS de Storage). Una ruta que el usuario escribió en la fila
# no puede apuntar a archivos de otra organización u otro proyecto.

from app.jobs.poller import run_gps_job, run_layer_job

ORG, PROJ = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"
AJENA = "99999999-9999-9999-9999-999999999999/33333333-3333-3333-3333-333333333333/layers/x/capa.shp"


class FakeStorage:
    def __init__(self) -> None:
        self.downloads: list[str] = []

    def from_(self, _bucket: str) -> "FakeStorage":
        return self

    def download(self, path: str) -> bytes:
        self.downloads.append(path)
        return b""


class FakeClient:
    def __init__(self) -> None:
        self.storage = FakeStorage()
        self.updates: list[tuple[str, dict[str, Any]]] = []

    def table(self, t: str) -> "FakeClient":
        self._t = t
        return self

    def update(self, u: dict[str, Any]) -> "FakeClient":
        self.updates.append((self._t, u))
        return self

    def eq(self, *_a: Any) -> "FakeClient":
        return self

    def execute(self) -> None:
        return None


def test_capa_con_ruta_de_otra_organizacion_no_se_descarga() -> None:
    c = FakeClient()
    job = {"id": "imp", "org_id": ORG, "project_id": PROJ, "format": "shp",
           "files": [{"path": AJENA, "ext": "shp"}]}
    run_layer_job(c, job)
    assert c.storage.downloads == []
    assert c.updates[-1][1]["status"] == "error"


def test_capa_con_ruta_de_otro_proyecto_de_la_misma_org_no_se_descarga() -> None:
    c = FakeClient()
    otro = f"{ORG}/33333333-3333-3333-3333-333333333333/layers/x/capa.shp"
    run_layer_job(c, {"id": "imp", "org_id": ORG, "project_id": PROJ, "format": "shp",
                      "files": [{"path": otro, "ext": "shp"}]})
    assert c.storage.downloads == []


def test_ruta_con_punto_punto_no_se_descarga() -> None:
    c = FakeClient()
    trampa = f"{ORG}/{PROJ}/../../{AJENA}"
    run_layer_job(c, {"id": "imp", "org_id": ORG, "project_id": PROJ, "format": "shp",
                      "files": [{"path": trampa, "ext": "shp"}]})
    assert c.storage.downloads == []


def test_gps_con_ruta_de_otra_organizacion_no_se_descarga() -> None:
    c = FakeClient()
    run_gps_job(c, {"id": "g", "org_id": ORG, "project_id": PROJ, "file_kind": "gpx",
                    "file_path": AJENA.replace("layers", "gps").replace("capa.shp", "t.gpx")})
    assert c.storage.downloads == []
    assert c.updates[-1][1]["status"] == "error"


def test_cada_trabajo_reclamado_queda_en_el_log(caplog: Any) -> None:
    import logging
    from app.jobs import poller

    class C:
        def rpc(self, _f: str, p: dict[str, str]) -> "C":
            self._t = p["p_table"]
            return self

        def execute(self) -> Any:
            return type("R", (), {"data": {"id": "g1"} if self._t == "gps_imports" else None})()

    vistos: list[str] = []
    orig = poller.run_gps_job
    poller.run_gps_job = lambda _c, j: vistos.append(j["id"])  # type: ignore[assignment]
    try:
        with caplog.at_level(logging.INFO, logger="eia.worker"):
            assert poller.poll_once(C()) is True
    finally:
        poller.run_gps_job = orig
    assert vistos == ["g1"]
    assert "gps_imports g1" in caplog.text


def test_el_worker_deja_su_latido_y_no_lo_repite_antes_de_tiempo() -> None:
    from app.jobs import poller

    escrito: list[dict[str, Any]] = []

    class C:
        def table(self, t: str) -> "C":
            assert t == "worker_heartbeat"
            return self

        def upsert(self, row: dict[str, Any]) -> "C":
            escrito.append(row)
            return self

        def execute(self) -> None:
            return None

    ultimo = poller.latido(C(), 0.0, ahora=100.0)
    assert ultimo == 100.0 and escrito[0]["id"] == "main" and "seen_at" in escrito[0]
    assert poller.latido(C(), ultimo, ahora=110.0) == 100.0 and len(escrito) == 1   # antes de 30 s no escribe
    assert poller.latido(C(), ultimo, ahora=131.0) == 131.0 and len(escrito) == 2
