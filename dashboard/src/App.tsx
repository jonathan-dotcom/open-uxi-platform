import { useEffect, useMemo, useState } from 'react';
import type { DiagnosticTest, ExperienceSensorOverview, FilterState, ServiceTestOverview, TileSensor } from './types';
import { Layout } from './components/Layout';
import { CirclesDashboard } from './components/CirclesDashboard';
import { TileViewByStatus } from './components/TileViewByStatus';
import { PathAnalysisSection } from './components/PathAnalysisSection';
import { SettingsManagementSection } from './components/SettingsManagementSection';
import { AlertsCenter } from './components/AlertsCenter';
import { LoadingState } from './components/LoadingState';
import { ErrorBanner } from './components/ErrorBanner';
import { useDashboardData } from './hooks/useDashboardData';

function filterSensors(sensors: ExperienceSensorOverview[], filter: FilterState) {
  return sensors.filter((sensor) => {
    if (!filter.states.includes(sensor.status)) {
      return false;
    }
    if (filter.group && sensor.group !== filter.group) {
      return false;
    }
    if (filter.wirelessNetwork && sensor.networkType === 'wireless' && sensor.network !== filter.wirelessNetwork) {
      return false;
    }
    if (filter.wiredNetwork && sensor.networkType === 'wired' && sensor.network !== filter.wiredNetwork) {
      return false;
    }
    return true;
  });
}

function filterTiles(tiles: TileSensor[], filter: FilterState) {
  return tiles.filter((tile) => {
    if (!filter.states.includes(tile.status)) {
      return false;
    }
    if (filter.group && tile.group !== filter.group) {
      return false;
    }
    if (filter.wirelessNetwork && tile.network === filter.wirelessNetwork) {
      return true;
    }
    if (filter.wiredNetwork && tile.network === filter.wiredNetwork) {
      return true;
    }
    if (filter.wirelessNetwork || filter.wiredNetwork) {
      return false;
    }
    return true;
  });
}

function filterDiagnostics<T extends { status: ExperienceSensorOverview['status'] }>(tests: T[], filter: FilterState): T[] {
  return tests.filter((test) => filter.states.includes(test.status));
}

function App() {
  const { data, loading, error, refresh, refreshing, summary } = useDashboardData();
  const [selectedCategory, setSelectedCategory] = useState<'experience' | 'services' | 'internal' | 'external'>('experience');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [circleTimeRange, setCircleTimeRange] = useState<string>(data.experience.timeRanges[0] ?? 'Last 60 minutes');
  const [filterState, setFilterState] = useState<FilterState>({
    states: data.overlays.filterOptions.states,
    group: null,
    wirelessNetwork: null,
    wiredNetwork: null
  });

  const filterStatesKey = useMemo(
    () => data.overlays.filterOptions.states.join(','),
    [data.overlays.filterOptions.states]
  );

  useEffect(() => {
    setFilterState((prev) => ({
      ...prev,
      states: data.overlays.filterOptions.states
    }));
  }, [filterStatesKey, data.overlays.filterOptions.states]);

  const filteredExperienceSensors = useMemo(
    () => filterSensors(data.experience.sensors, filterState),
    [data.experience.sensors, filterState]
  );

  const filteredServiceTests = useMemo(
    () => filterDiagnostics<ServiceTestOverview>(data.servicesCatalog.tests, filterState),
    [data.servicesCatalog.tests, filterState]
  );

  const filteredInternalTests = useMemo(
    () => filterDiagnostics<DiagnosticTest>(data.internalTests, filterState),
    [data.internalTests, filterState]
  );

  const filteredExternalTests = useMemo(
    () => filterDiagnostics<DiagnosticTest>(data.externalTests, filterState),
    [data.externalTests, filterState]
  );

  const filteredTiles = useMemo(() => filterTiles(data.tiles, filterState), [data.tiles, filterState]);

  const tileLookup = useMemo(() => new Map(data.tiles.map((tile) => [tile.id, tile])), [data.tiles]);
  const experienceByName = useMemo(
    () => new Map(data.experience.sensors.map((sensor) => [sensor.name, sensor.id])),
    [data.experience.sensors]
  );

  useEffect(() => {
    const options =
      selectedCategory === 'services'
        ? data.servicesCatalog.timeRanges
        : selectedCategory === 'internal' || selectedCategory === 'external'
          ? data.servicesCatalog.timeRanges
          : data.experience.timeRanges;
    if (!options.includes(circleTimeRange)) {
      setCircleTimeRange(options[0] ?? circleTimeRange);
    }
  }, [circleTimeRange, data.experience.timeRanges, data.servicesCatalog.timeRanges, selectedCategory]);

  useEffect(() => {
    const items = (() => {
      switch (selectedCategory) {
        case 'experience':
          return filteredExperienceSensors;
        case 'services':
          return filteredServiceTests;
        case 'internal':
          return filteredInternalTests;
        case 'external':
          return filteredExternalTests;
        default:
          return [];
      }
    })();
    if (!items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0]?.id ?? null);
    }
  }, [filteredExperienceSensors, filteredServiceTests, filteredInternalTests, filteredExternalTests, selectedCategory, selectedItemId]);

  const timeRanges = useMemo(() => {
    switch (selectedCategory) {
      case 'services':
        return data.servicesCatalog.timeRanges;
      case 'internal':
      case 'external':
        return data.servicesCatalog.timeRanges;
      default:
        return data.experience.timeRanges;
    }
  }, [data.experience.timeRanges, data.servicesCatalog.timeRanges, selectedCategory]);

  return (
    <Layout
      generatedAt={data.generatedAt}
      onRefresh={refresh}
      refreshing={refreshing}
      summary={summary}
      updates={data.overlays.updates}
      notifications={data.overlays.notifications}
      filterOptions={data.overlays.filterOptions}
      filterState={filterState}
      onFilterChange={setFilterState}
      counts={data.counts}
    >
      {loading && <LoadingState />}
      {error && <ErrorBanner message={error} onRetry={refresh} />}

      <CirclesDashboard
        experienceSensors={filteredExperienceSensors}
        serviceTests={filteredServiceTests}
        internalTests={filteredInternalTests}
        externalTests={filteredExternalTests}
        selectedCategory={selectedCategory}
        onSelectCategory={(category) => {
          setSelectedCategory(category);
        }}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
        timeRanges={timeRanges}
        selectedTimeRange={circleTimeRange}
        onTimeRangeChange={setCircleTimeRange}
      />

      <TileViewByStatus
        sensors={filteredTiles}
        onSelect={(sensorId) => {
          const tile = tileLookup.get(sensorId);
          if (tile) {
            const sensorIdMatch = experienceByName.get(tile.name) ?? null;
            setSelectedCategory('experience');
            setSelectedItemId(sensorIdMatch);
          }
        }}
      />

      <PathAnalysisSection data={data.pathAnalysis} />

      <SettingsManagementSection
        groups={data.management.groups}
        sensors={data.management.sensors}
        agents={data.management.agents}
        networks={data.management.networks}
        services={data.management.services}
      />

      <AlertsCenter config={data.alertsConfig} />

      <footer className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        <div className="flex flex-col gap-2 text-xs uppercase tracking-wide text-white/60 md:flex-row md:items-center md:justify-between">
          <span>Sensors online: <span className="text-white">{data.counts.sensorsOnline}</span></span>
          <span>Agents online: <span className="text-white">{data.counts.agentsOnline}</span></span>
          <span>Reporting window: <span className="text-white">{data.reportingWindow}</span></span>
        </div>
      </footer>
    </Layout>
  );
}

export default App;
