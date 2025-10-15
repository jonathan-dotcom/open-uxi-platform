const express = require('express');
const https = require('https');
const { performance } = require('perf_hooks');

const app = express();
const port = parseInt(process.env.FAST_EXPORTER_PORT || '9801', 10);
const timeoutSeconds = parseInt(process.env.FAST_EXPORTER_TIMEOUT || '180', 10);
const sampleTtlSeconds = parseInt(process.env.FAST_EXPORTER_SAMPLE_TTL || '600', 10);
const downloadDurationSeconds = Math.min(parseInt(process.env.FAST_EXPORTER_RUN_DURATION || '15', 10), timeoutSeconds);
const token = process.env.FAST_EXPORTER_TOKEN || 'YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm';
const urlCount = Math.max(1, parseInt(process.env.FAST_EXPORTER_URL_COUNT || '5', 10));
const concurrency = Math.max(1, parseInt(process.env.FAST_EXPORTER_CONCURRENCY || '3', 10));
const latencySamples = Math.max(1, parseInt(process.env.FAST_EXPORTER_LATENCY_SAMPLES || '5', 10));
const runOnEveryScrape = (process.env.FAST_EXPORTER_FORCE_RUN || 'false').toLowerCase() === 'true';

let lastSample = null;
let lastError = null;
let runningPromise = null;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'fast-exporter/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          res.resume();
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function getTargets() {
  const endpoint = `https://api.fast.com/netflix/speedtest/v2?https=true&token=${encodeURIComponent(token)}&urlCount=${urlCount}`;
  const data = await fetchJson(endpoint);
  const targets = data.targets || [];
  if (!targets.length) {
    throw new Error('Fast.com API returned no targets');
  }
  return { targets, client: data.client || {} };
}

async function measureLatency(targetUrl) {
  const times = [];
  for (let i = 0; i < latencySamples; i++) {
    const start = performance.now();
    await new Promise((resolve) => {
      const req = https.get(targetUrl, { headers: { Range: 'bytes=0-1023', 'User-Agent': 'fast-exporter/1.0' } }, (res) => {
        const finalize = () => resolve();
        res.on('data', () => {
          req.destroy();
        });
        res.on('end', finalize);
        res.on('error', finalize);
        res.on('close', finalize);
      });
      req.on('error', () => resolve());
    });
    times.push(performance.now() - start);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  const variance = times.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / times.length;
  const jitter = Math.sqrt(variance);
  return { latencyMs: mean, jitterMs: jitter };
}

async function measureDownload(targets) {
  const start = Date.now();
  const deadline = start + downloadDurationSeconds * 1000;
  let totalBytes = 0;

  const runDownload = (target) =>
    new Promise((resolve) => {
      const req = https.get(target.url, { headers: { 'User-Agent': 'fast-exporter/1.0' } }, (res) => {
        const finalize = () => resolve();
        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (Date.now() >= deadline) {
            req.destroy();
          }
        });
        res.on('error', finalize);
        res.on('end', finalize);
        res.on('close', finalize);
      });
      req.on('error', () => resolve());
    });

  await Promise.all(targets.slice(0, concurrency).map(runDownload));
  const durationSecondsActual = Math.max(0.001, (Date.now() - start) / 1000);
  const bitsPerSecond = (totalBytes * 8) / durationSecondsActual;
  return {
    bitsPerSecond,
    bytes: totalBytes,
    durationSeconds: durationSecondsActual,
    target: targets[0],
  };
}

async function runMeasurement() {
  if (runningPromise) {
    return runningPromise;
  }
  runningPromise = (async () => {
    const measurementStart = Date.now();
    try {
      const { targets, client } = await Promise.race([
        getTargets(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out getting targets')), timeoutSeconds * 1000)),
      ]);

      const [download, latency] = await Promise.all([
        Promise.race([
          measureDownload(targets),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out during download test')), timeoutSeconds * 1000)),
        ]),
        Promise.race([
          measureLatency(targets[0].url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out during latency test')), timeoutSeconds * 1000)),
        ]),
      ]);

      lastSample = {
        timestamp: Date.now(),
        downloadBps: download.bitsPerSecond,
        downloadBytes: download.bytes,
        durationSeconds: download.durationSeconds,
        server: download.target,
        client,
        pingMs: latency.latencyMs,
        jitterMs: latency.jitterMs,
        totalDurationSeconds: (Date.now() - measurementStart) / 1000,
      };
      lastError = null;
    } catch (error) {
      lastError = {
        message: error.message || 'fast.com measurement failed',
        timestamp: Date.now(),
      };
      lastSample = null;
    } finally {
      runningPromise = null;
    }
  })();
  return runningPromise;
}

function renderMetrics() {
  const lines = [];
  if (!lastSample) {
    lines.push('# HELP fast_exporter_up Whether the last fast.com measurement succeeded (1) or not (0).');
    lines.push('# TYPE fast_exporter_up gauge');
    lines.push('fast_exporter_up 0');
    if (lastError) {
      lines.push('# HELP fast_exporter_last_error_timestamp_seconds Unix timestamp of the last failure.');
      lines.push('# TYPE fast_exporter_last_error_timestamp_seconds gauge');
      lines.push(`fast_exporter_last_error_timestamp_seconds ${lastError.timestamp / 1000}`);
    }
    return lines.join('\n') + '\n';
  }

  const { downloadBps, downloadBytes, durationSeconds, server, client, pingMs, jitterMs, timestamp, totalDurationSeconds } = lastSample;
  const labels = [];
  if (server) {
    if (server.location?.city) labels.push(`server_city="${String(server.location.city).replace(/"/g, '\\"')}"`);
    if (server.location?.country) labels.push(`server_country="${String(server.location.country).replace(/"/g, '\\"')}"`);
    if (server.name) labels.push(`server_name="${String(server.name).replace(/"/g, '\\"')}"`);
    if (server.url) labels.push(`server_url="${String(server.url).replace(/"/g, '\\"')}"`);
  }
  if (client?.location?.city) labels.push(`client_city="${String(client.location.city).replace(/"/g, '\\"')}"`);
  if (client?.location?.country) labels.push(`client_country="${String(client.location.country).replace(/"/g, '\\"')}"`);
  if (client?.ip) labels.push(`client_ip="${String(client.ip).replace(/"/g, '\\"')}"`);
  if (client?.asn) labels.push(`client_asn="${String(client.asn).replace(/"/g, '\\"')}"`);
  const labelStr = labels.length ? `{${labels.join(',')}}` : '';

  lines.push('# HELP fast_exporter_up Whether the last fast.com measurement succeeded (1) or not (0).');
  lines.push('# TYPE fast_exporter_up gauge');
  lines.push('fast_exporter_up 1');

  lines.push('# HELP fast_download_bits_per_second Last measured fast.com download throughput in bits per second.');
  lines.push('# TYPE fast_download_bits_per_second gauge');
  lines.push(`fast_download_bits_per_second${labelStr} ${downloadBps}`);

  lines.push('# HELP fast_download_bytes_total Bytes downloaded during the most recent fast.com measurement.');
  lines.push('# TYPE fast_download_bytes_total gauge');
  lines.push(`fast_download_bytes_total${labelStr} ${downloadBytes}`);

  lines.push('# HELP fast_ping_latency_milliseconds Estimated fast.com latency in milliseconds.');
  lines.push('# TYPE fast_ping_latency_milliseconds gauge');
  lines.push(`fast_ping_latency_milliseconds${labelStr} ${pingMs}`);

  lines.push('# HELP fast_jitter_latency_milliseconds Estimated jitter during the fast.com latency sampling in milliseconds.');
  lines.push('# TYPE fast_jitter_latency_milliseconds gauge');
  lines.push(`fast_jitter_latency_milliseconds${labelStr} ${jitterMs}`);

  lines.push('# HELP fast_exporter_duration_seconds Duration of the download measurement in seconds.');
  lines.push('# TYPE fast_exporter_duration_seconds gauge');
  lines.push(`fast_exporter_duration_seconds ${durationSeconds}`);

  lines.push('# HELP fast_exporter_total_runtime_seconds Total runtime for the fast.com measurement, including setup.');
  lines.push('# TYPE fast_exporter_total_runtime_seconds gauge');
  lines.push(`fast_exporter_total_runtime_seconds ${totalDurationSeconds}`);

  lines.push('# HELP fast_exporter_last_run_timestamp_seconds Unix timestamp of the last successful fast.com measurement.');
  lines.push('# TYPE fast_exporter_last_run_timestamp_seconds gauge');
  lines.push(`fast_exporter_last_run_timestamp_seconds ${timestamp / 1000}`);

  return lines.join('\n') + '\n';
}

app.get('/metrics', async (_req, res) => {
  res.type('text/plain; charset=utf-8');
  try {
    const shouldRun = runOnEveryScrape || !lastSample || ((Date.now() - lastSample.timestamp) / 1000 > sampleTtlSeconds);
    if (shouldRun) {
      await Promise.race([
        runMeasurement(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Measurement timed out')), timeoutSeconds * 1000)),
      ]);
    }
  } catch (error) {
    lastError = {
      message: error.message || 'measurement error',
      timestamp: Date.now(),
    };
    lastSample = null;
  }
  res.send(renderMetrics());
});

app.get('/healthz', (_req, res) => {
  if (lastSample) {
    res.status(200).json({ status: 'ok', lastRun: lastSample.timestamp });
  } else if (lastError) {
    res.status(503).json({ status: 'error', error: lastError });
  } else {
    res.status(503).json({ status: 'unknown' });
  }
});

app.listen(port, () => {
  console.log(`fast-exporter listening on port ${port}`);
});
