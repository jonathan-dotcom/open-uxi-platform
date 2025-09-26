FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY radius_exporter.py ./
COPY dictionary ./dictionary

ENV EXPORTER_CONFIG=/app/config.yml \
    EXPORTER_PORT=9812 \
    EXPORTER_INTERVAL=60 \
    EXPORTER_TIMEOUT=5

EXPOSE 9812

ENTRYPOINT ["python", "/app/radius_exporter.py"]
