FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY vpn_exporter.py ./

ENV EXPORTER_CONFIG=/app/config.yml \
    EXPORTER_PORT=9310 \
    EXPORTER_INTERVAL=60 \
    EXPORTER_TIMEOUT=5

EXPOSE 9310

ENTRYPOINT ["python", "/app/vpn_exporter.py"]
