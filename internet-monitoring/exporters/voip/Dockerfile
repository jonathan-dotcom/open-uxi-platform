FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY voip_quality_exporter.py ./

ENV EXPORTER_CONFIG=/app/config.yml \
    EXPORTER_PORT=9899 \
    EXPORTER_INTERVAL=30 \
    EXPORTER_TIMEOUT=5

EXPOSE 9899

ENTRYPOINT ["python", "/app/voip_quality_exporter.py"]
