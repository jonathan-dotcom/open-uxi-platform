import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Cloud, Globe2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { KpiCard } from './components/KpiCard';
import { TimelineChart } from './components/TimelineChart';
import { JourneyGrid } from './components/JourneyGrid';
import { SensorTable } from './components/SensorTable';
import { AlertsPanel } from './components/AlertsPanel';
import { SensorDetailPanel } from './components/SensorDetailPanel';
import { LoadingState } from './components/LoadingState';
import { ErrorBanner } from './components/ErrorBanner';
import { useDashboardData } from './hooks/useDashboardData';
import { formatPercent, formatRate } from './utils/format';
import type { Sensor } from './types';

function App() {
  const { data, loading, error, refresh, refreshing, summary } = useDashboardData();
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);

  useEffect(() => {
    if (data.sensors.length === 0) {
      setSelectedSensorId(null);
      return;
    }
    if (!selectedSensorId || !data.sensors.some((sensor) => sensor.id === selectedSensorId)) {
      setSelectedSensorId(data.sensors[0].id);
    }
  }, [data.sensors, selectedSensorId]);

  const selectedSensor: Sensor | null = useMemo(
    () => data.sensors.find((sensor) => sensor.id === selectedSensorId) ?? null,
    [data.sensors, selectedSensorId]
  );

  const kpis = data.kpis;

  return (
    <Layout generatedAt={data.generatedAt} onRefresh={refresh} refreshing={refreshing} summary={summary}>
      {loading && <LoadingState />}
      {error && <ErrorBanner message={error} onRetry={refresh} />}

      <div className="grid gap-6 lg:grid-cols-4">
        <KpiCard
          title="Global availability"
          value={formatPercent(kpis.globalAvailability)}
          change={kpis.availabilityChange}
          subtitle="Rolling 7-day window"
          icon={<Globe2 className="h-6 w-6" />}
        />
        <KpiCard
          title="Median latency"
          value={`${kpis.medianLatency.toFixed(0)} ms`}
          change={kpis.latencyChange}
          subtitle="Sensor to SaaS"
          icon={<Activity className="h-6 w-6" />}
        />
        <KpiCard
          title="Active incidents"
          value={kpis.activeIncidents.toString()}
          change={kpis.incidentChange}
          subtitle="Across global fleet"
          icon={<AlertTriangle className="h-6 w-6" />}
        />
        <KpiCard
          title="Cloud ingest"
          value={formatRate(kpis.ingestRate)}
          change={kpis.ingestChange}
          subtitle="Events streaming"
          icon={<Cloud className="h-6 w-6" />}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimelineChart points={data.timeline} reportingWindow={data.reportingWindow} />
        </div>
        <AlertsPanel alerts={data.alerts} />
      </div>

      <div className="mt-8">
        <JourneyGrid journeys={data.journeys} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SensorTable sensors={data.sensors} selectedSensorId={selectedSensorId} onSelect={(id) => setSelectedSensorId(id)} />
        </div>
        <div className="lg:col-span-2">
          <SensorDetailPanel sensor={selectedSensor} />
        </div>
      </div>
    </Layout>
  );
}

export default App;
