from fastapi import FastAPI

app = FastAPI(title="eia-worker")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

# El bucle de sondeo de trabajos (claim_job) se agrega en el sprint 2.
