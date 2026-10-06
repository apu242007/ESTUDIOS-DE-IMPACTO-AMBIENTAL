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
