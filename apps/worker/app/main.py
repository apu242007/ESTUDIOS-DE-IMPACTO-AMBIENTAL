import logging
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.jobs.poller import poll_forever

# Sin esto, los INFO del worker (trabajos tomados) no salen en worker.log y una caída no deja rastro.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # una línea por consulta a Supabase: ruido
log = logging.getLogger("eia.worker")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    stop = threading.Event()
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    thread = None
    if url and key:
        from supabase import create_client
        client = create_client(url, key)
        thread = threading.Thread(
            target=poll_forever, args=(client, float(os.getenv("POLL_SECONDS", "3")), stop),
            daemon=True, name="poller")
        thread.start()
    else:
        log.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no definidos: sondeo desactivado")
    yield
    stop.set()


app = FastAPI(title="eia-worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
