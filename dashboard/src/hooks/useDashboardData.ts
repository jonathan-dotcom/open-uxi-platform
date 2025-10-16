import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DashboardSnapshot,
  SensorPerformancePoint,
  ServiceMetricSeries,
  TimelinePoint
} from '../types';
import { fallbackDashboard } from '../data/sampleData';

type WithTimestamp<T> = T & { timestamp: string };

function sortByTimestamp<T>(points: WithTimestamp<T>[]): WithTimestamp<T>[] {
  return [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizePerformance(points: SensorPerformancePoint[]): SensorPerformancePoint[] {
  return [...points]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((point) => ({
      ...point,
      availability: Number(point.availability.toFixed(2)),
      latencyMs: Number(point.latencyMs.toFixed(0)),
      jitterMs: Number(point.jitterMs.toFixed(0)),
      packetLoss: Number(point.packetLoss.toFixed(2))
    }));
}

function normalizeMetricSeries(series: ServiceMetricSeries): ServiceMetricSeries {
  return {
    ...series,
    points: [...series.points]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((point) => ({
        ...point,
        value: Number(point.value)
      }))
  };
}

function coerceSnapshot(snapshot: DashboardSnapshot): DashboardSnapshot {
  const base = fallbackDashboard;
  const sensors = (snapshot.sensors ?? base.sensors).map((sensor) => ({
    ...sensor,
    performance: normalizePerformance(sensor.performance)
  }));

  const experienceSensors = (snapshot.experience?.sensors ?? base.experience.sensors).map((sensor) => ({
    ...sensor,
    performance: normalizePerformance(sensor.performance)
  }));

  const serviceTests = (snapshot.servicesCatalog?.tests ?? base.servicesCatalog.tests).map((test) => ({
    ...test,
    metrics: test.metrics.map((series) => normalizeMetricSeries(series))
  }));

  const internalTests = (snapshot.internalTests ?? base.internalTests).map((test) => ({
    ...test,
    metrics: test.metrics.map((series) => normalizeMetricSeries(series))
  }));

  const externalTests = (snapshot.externalTests ?? base.externalTests).map((test) => ({
    ...test,
    metrics: test.metrics.map((series) => normalizeMetricSeries(series))
  }));

  const servicesInventory = (snapshot.management?.services ?? base.management.services).map((service) => ({
    ...service,
    metrics: service.metrics.map((series) => normalizeMetricSeries(series))
  }));

  return {
    ...base,
    ...snapshot,
    timeline: sortByTimestamp((snapshot.timeline ?? base.timeline) as WithTimestamp<TimelinePoint>[]),
    sensors,
    alerts: snapshot.alerts ?? base.alerts,
    experience: {
      timeRanges: snapshot.experience?.timeRanges ?? base.experience.timeRanges,
      sensors: experienceSensors
    },
    servicesCatalog: {
      timeRanges: snapshot.servicesCatalog?.timeRanges ?? base.servicesCatalog.timeRanges,
      tests: serviceTests
    },
    internalTests,
    externalTests,
    tiles: snapshot.tiles ?? base.tiles,
    pathAnalysis: snapshot.pathAnalysis ?? base.pathAnalysis,
    overlays: snapshot.overlays ?? base.overlays,
    management: {
      groups: snapshot.management?.groups ?? base.management.groups,
      sensors: snapshot.management?.sensors ?? base.management.sensors,
      agents: snapshot.management?.agents ?? base.management.agents,
      networks: snapshot.management?.networks ?? base.management.networks,
      services: servicesInventory
    },
    alertsConfig: snapshot.alertsConfig ?? base.alertsConfig,
    account: snapshot.account ?? base.account,
    counts: snapshot.counts ?? base.counts
  };
}

function resolveApiUrl(path: string): string {
  const base = import.meta.env.VITE_DASHBOARD_API_BASE as string | undefined;
  if (!base) {
    return path;
  }
  const normalized = base.replace(/\/$/, '');
  return `${normalized}${path}`;
}

function resolveStreamUrl(): string | null {
  const direct = import.meta.env.VITE_DASHBOARD_STREAM_URL as string | undefined;
  if (direct) {
    return direct;
  }
  const base = import.meta.env.VITE_DASHBOARD_API_BASE as string | undefined;
  if (!base) {
    return null;
  }
  try {
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const streamPortEnv = import.meta.env.VITE_DASHBOARD_STREAM_PORT as string | undefined;
    const streamPortEnvIsNumeric = !!streamPortEnv && /^\d+$/.test(streamPortEnv);
    if (streamPortEnv && !streamPortEnvIsNumeric) {
      console.warn('Ignoring invalid VITE_DASHBOARD_STREAM_PORT value; expected numeric port');
    }
    const streamPort = streamPortEnvIsNumeric ? streamPortEnv : '8766';
    url.port = streamPort;
    url.pathname = '/';
    return url.toString();
  } catch (error) {
    console.warn('Failed to derive stream URL from API base', error);
    return null;
  }
}

function isDashboardPayload(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  const experience = payload.experience as Record<string, unknown> | undefined;
  const servicesCatalog = payload.servicesCatalog as Record<string, unknown> | undefined;
  const pathAnalysis = payload.pathAnalysis as Record<string, unknown> | undefined;
  const overlays = payload.overlays as Record<string, unknown> | undefined;
  const management = payload.management as Record<string, unknown> | undefined;
  const alertsConfig = payload.alertsConfig as Record<string, unknown> | undefined;
  const counts = payload.counts as Record<string, unknown> | undefined;
  const account = payload.account as Record<string, unknown> | undefined;

  return (
    typeof payload.generatedAt === 'string' &&
    typeof payload.reportingWindow === 'string' &&
    typeof payload.kpis === 'object' &&
    Array.isArray(payload.timeline) &&
    Array.isArray(payload.sensors) &&
    Array.isArray(payload.journeys) &&
    experience !== undefined &&
    Array.isArray(experience.sensors as unknown[]) &&
    servicesCatalog !== undefined &&
    Array.isArray(servicesCatalog.tests as unknown[]) &&
    Array.isArray(payload.internalTests as unknown[]) &&
    Array.isArray(payload.externalTests as unknown[]) &&
    Array.isArray(payload.tiles as unknown[]) &&
    pathAnalysis !== undefined &&
    Array.isArray(pathAnalysis.routes as unknown[]) &&
    overlays !== undefined &&
    typeof overlays.filterOptions === 'object' &&
    management !== undefined &&
    typeof management.groups === 'object' &&
    typeof management.sensors === 'object' &&
    typeof management.agents === 'object' &&
    typeof management.networks === 'object' &&
    typeof management.services === 'object' &&
    alertsConfig !== undefined &&
    counts !== undefined &&
    account !== undefined
  );
}

function decodeBase64Json(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  try {
    const decoder = typeof atob === 'function' ? atob : null;
    if (!decoder) {
      console.warn('Base64 decoder unavailable in this environment');
      return null;
    }
    const decoded = decoder(value);
    return JSON.parse(decoded) as unknown;
  } catch (error) {
    console.warn('Failed to decode base64 snapshot payload', error);
    return null;
  }
}

function extractDashboardFromStream(message: unknown): DashboardSnapshot | null {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const payload = message as Record<string, unknown>;
  switch (payload.type) {
    case 'dashboard': {
      const dashboard = payload.dashboard;
      return isDashboardPayload(dashboard) ? dashboard : null;
    }
    case 'snapshot': {
      const snapshot = payload.snapshot as Record<string, unknown> | undefined;
      if (!snapshot) return null;
      if (isDashboardPayload(snapshot.payload_json)) {
        return snapshot.payload_json;
      }
      const decoded = decodeBase64Json(snapshot.payload_base64);
      return isDashboardPayload(decoded) ? decoded : null;
    }
    case 'snapshot_batch': {
      const snapshots = payload.snapshots;
      if (!Array.isArray(snapshots)) {
        return null;
      }
      for (const entry of snapshots) {
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (isDashboardPayload(record.payload_json)) {
            return record.payload_json;
          }
          const decoded = decodeBase64Json(record.payload_base64);
          if (isDashboardPayload(decoded)) {
            return decoded;
          }
        }
      }
      return null;
    }
    default:
      return null;
  }
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardSnapshot>(fallbackDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pipelineEndpoint = useMemo(() => resolveApiUrl('/v1/dashboard'), []);
  const streamUrl = useMemo(() => resolveStreamUrl(), []);
  const streamRef = useRef<WebSocket | null>(null);

  const fetchSnapshot = useCallback(async (signal?: AbortSignal) => {
    try {
      setRefreshing(true);
      let apiError: Error | null = null;

      try {
        const response = await fetch(pipelineEndpoint, {
          cache: 'no-store',
          signal
        });
        if (!response.ok) {
          throw new Error(`Pipeline dashboard responded with ${response.status}`);
        }
        const payload = (await response.json()) as DashboardSnapshot;
        setData(coerceSnapshot(payload));
        setError(null);
        return;
      } catch (primaryError) {
        if ((primaryError as Error).name === 'AbortError') {
          return;
        }
        apiError = primaryError as Error;
        console.warn('Pipeline dashboard unavailable, falling back to static snapshot', apiError);
      }

      try {
        const response = await fetch('/data/dashboard.json', {
          cache: 'no-store',
          signal
        });
        if (!response.ok) {
          throw new Error(`Failed to load bundled dashboard snapshot: ${response.status}`);
        }
        const payload = (await response.json()) as DashboardSnapshot;
        setData(coerceSnapshot(payload));
        setError(apiError ? `Fell back to bundled snapshot: ${apiError.message}` : null);
        return;
      } catch (fallbackError) {
        if ((fallbackError as Error).name === 'AbortError') {
          return;
        }
        console.error('Failed to load fallback dashboard snapshot, using hard-coded sample', fallbackError);
        setError((fallbackError as Error).message);
        setData(coerceSnapshot(fallbackDashboard));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pipelineEndpoint]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSnapshot(controller.signal);
    return () => controller.abort();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!streamUrl) {
      return undefined;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) {
        return;
      }
      try {
        const ws = new WebSocket(streamUrl);
        streamRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as unknown;
            const dashboard = extractDashboardFromStream(payload);
            if (dashboard) {
              setData(coerceSnapshot(dashboard));
              setError(null);
              setLoading(false);
            }
          } catch (streamError) {
            console.warn('Failed to process dashboard stream message', streamError);
          }
        };

        ws.onclose = () => {
          streamRef.current = null;
          if (!cancelled) {
            reconnectTimer = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (connectionError) {
        console.warn('Failed to establish dashboard stream connection', connectionError);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [streamUrl]);

  const summary = useMemo(
    () => ({
      sensorCount: data.sensors.length,
      impactedJourneys: data.journeys.filter((journey) => journey.status !== 'operational').length,
      criticalAlerts: data.alerts.filter((alert) => alert.severity === 'critical').length
    }),
    [data]
  );

  const refresh = useCallback(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  return { data, loading, error, refresh, refreshing, summary };
}
