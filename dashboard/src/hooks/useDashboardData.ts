import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardSnapshot } from '../types';
import { fallbackDashboard } from '../data/sampleData';

type WithTimestamp<T> = T & { timestamp: string };

function sortByTimestamp<T>(points: WithTimestamp<T>[]): WithTimestamp<T>[] {
  return [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function coerceSnapshot(snapshot: DashboardSnapshot): DashboardSnapshot {
  return {
    ...snapshot,
    timeline: sortByTimestamp(snapshot.timeline),
    sensors: snapshot.sensors.map((sensor) => ({
      ...sensor,
      performance: sortByTimestamp(sensor.performance).map((point) => ({
        ...point,
        availability: Number(point.availability.toFixed(2)),
        latencyMs: Number(point.latencyMs.toFixed(0)),
        jitterMs: Number(point.jitterMs.toFixed(0)),
        packetLoss: Number(point.packetLoss.toFixed(2))
      }))
    }))
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

export function useDashboardData() {
  const [data, setData] = useState<DashboardSnapshot>(fallbackDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pipelineEndpoint = useMemo(() => resolveApiUrl('/v1/dashboard'), []);

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
