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

export function useDashboardData() {
  const [data, setData] = useState<DashboardSnapshot>(fallbackDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSnapshot = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setRefreshing(true);
      const response = await fetch('/data/dashboard.json', {
        cache: 'no-store',
        signal
      });
      if (!response.ok) {
        throw new Error(`Failed to load dashboard snapshot: ${response.status}`);
      }
      const payload = (await response.json()) as DashboardSnapshot;
      setData(coerceSnapshot(payload));
    } catch (fetchError) {
      if ((fetchError as Error).name !== 'AbortError') {
        console.warn('Falling back to bundled dashboard snapshot', fetchError);
        setError((fetchError as Error).message);
        setData(coerceSnapshot(fallbackDashboard));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
