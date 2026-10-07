"""Una pasada del worker: procesa toda la cola y termina. La usa GitHub Actions (.github/workflows/worker.yml),
que la dispara cuando entra un trabajo (migración 0025) y cada 15 min de respaldo, así la cola no depende de una PC.

No reencola trabajos 'procesando': otro worker (la PC) podría tenerlos tomados en ese momento.
Uso: python -m app.run_once  (con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno)
"""
from __future__ import annotations

import datetime as dt
import logging
import os
import sys
from typing import Any

from app.jobs.poller import poll_once

log = logging.getLogger("eia.worker")


def procesar_cola(client: Any, tope: int = 200) -> int:
    """Deja el latido de la nube y procesa trabajos hasta vaciar la cola (o llegar al tope). Devuelve cuántos hizo."""
    client.table("worker_heartbeat").upsert({"id": "actions", "seen_at": dt.datetime.now(dt.timezone.utc).isoformat()}).execute()
    hechos = 0
    while hechos < tope and poll_once(client):
        hechos += 1
    return hechos


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        log.error("faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
        return 1
    from supabase import create_client

    hechos = procesar_cola(create_client(url, key))
    log.info("cola vacía: %d trabajo(s) procesado(s)", hechos)
    return 0


if __name__ == "__main__":
    sys.exit(main())
