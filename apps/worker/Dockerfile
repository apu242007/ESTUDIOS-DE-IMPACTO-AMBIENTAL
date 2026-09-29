FROM python:3.12-slim

# GPSBabel (sprint 4) y LibreOffice (sprint 5) ya instalados
RUN apt-get update && apt-get install -y --no-install-recommends \
      gpsbabel libreoffice-writer fonts-liberation libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
