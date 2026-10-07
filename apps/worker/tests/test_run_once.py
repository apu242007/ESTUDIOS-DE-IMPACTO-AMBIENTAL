from typing import Any

from app import run_once


def test_una_pasada_procesa_toda_la_cola_deja_latido_de_nube_y_termina(monkeypatch: Any) -> None:
    trabajos = [True, True, False]
    monkeypatch.setattr(run_once, "poll_once", lambda _c: trabajos.pop(0))
    latidos: list[str] = []

    class C:
        def table(self, t: str) -> "C":
            assert t == "worker_heartbeat"
            return self

        def upsert(self, row: dict[str, Any]) -> "C":
            latidos.append(row["id"])
            return self

        def execute(self) -> None:
            return None

    assert run_once.procesar_cola(C()) == 2
    assert trabajos == [] and latidos == ["actions"]


def test_una_pasada_tiene_tope_para_no_quedar_en_un_bucle(monkeypatch: Any) -> None:
    monkeypatch.setattr(run_once, "poll_once", lambda _c: True)

    class C:
        def table(self, _t: str) -> "C":
            return self

        def upsert(self, _r: dict[str, Any]) -> "C":
            return self

        def execute(self) -> None:
            return None

    assert run_once.procesar_cola(C(), tope=5) == 5
