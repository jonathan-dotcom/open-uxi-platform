import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  FileText,
  Grid,
  Link2,
  MapPin,
  Network,
  Radar,
  Route,
  Settings,
  Sparkles,
  User,
  Users,
  Wifi
} from 'lucide-react';
import type {
  DiagnosticTest,
  ExperienceSensorOverview,
  FilterState,
  ServiceTestOverview,
  TileSensor
} from './types';
import { Layout } from './components/Layout';
import { CirclesDashboard, CircleDetailDescriptor } from './components/CirclesDashboard';
import { CirclesDetailView, CircleDetailState } from './components/CirclesDetailView';
import { TileViewByStatus } from './components/TileViewByStatus';
import { PathAnalysisSection } from './components/PathAnalysisSection';
import {
  AgentsManagementPage,
  GroupsManagementPage,
  NetworksManagementPage,
  SensorsManagementPage,
  ServicesManagementPage
} from './components/management/ManagementPages';
import { AlertsNotificationsPage, AlertsThresholdsPage } from './components/alerts/AlertsPages';
import {
  AccountSettingsPage,
  AiOpsPage,
  IntegrationsPage,
  ProfilePage,
  ReportsPage,
  SubscriptionsPage,
  TeamPage
} from './components/account/AccountPages';
import { LoadingState } from './components/LoadingState';
import { ErrorBanner } from './components/ErrorBanner';
import { useDashboardData } from './hooks/useDashboardData';
import { formatDateTime } from './utils/format';

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

type PageId =
  | 'dashboard/circles'
  | 'dashboard/tiles'
  | 'dashboard/path'
  | 'management/groups'
  | 'management/sensors'
  | 'management/agents'
  | 'management/networks'
  | 'management/services'
  | 'alerts/thresholds'
  | 'alerts/notifications'
  | 'account/reports'
  | 'account/aiops'
  | 'account/subscriptions'
  | 'account/integrations'
  | 'account/profile'
  | 'account/team'
  | 'account/settings';

interface NavSection {
  id: string;
  label: string;
  items: { id: PageId; label: string; icon: ReactNode }[];
}

function resolveDetail(
  descriptor: CircleDetailDescriptor,
  experience: ExperienceSensorOverview[],
  services: ServiceTestOverview[],
  internal: DiagnosticTest[],
  external: DiagnosticTest[]
): CircleDetailState | null {
  if (descriptor.kind === 'experience') {
    const sensor = experience.find((entry) => entry.id === descriptor.id);
    return sensor ? { kind: 'experience', item: sensor } : null;
  }
  if (descriptor.kind === 'service') {
    const service = services.find((entry) => entry.id === descriptor.id);
    return service ? { kind: 'service', item: service } : null;
  }
  if (descriptor.kind === 'internal') {
    const test = internal.find((entry) => entry.id === descriptor.id);
    return test ? { kind: 'internal', item: test } : null;
  }
  const externalTest = external.find((entry) => entry.id === descriptor.id);
  return externalTest ? { kind: 'external', item: externalTest } : null;
}

function App() {
  const { data, loading, error, refresh, refreshing, summary } = useDashboardData();
  const [filterState, setFilterState] = useState<FilterState>({
    states: data.overlays.filterOptions.states,
    group: null,
    wirelessNetwork: null,
    wiredNetwork: null
  });
  const [activeNav, setActiveNav] = useState<PageId>('dashboard/circles');
  const [detail, setDetail] = useState<CircleDetailState | null>(null);

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

  useEffect(() => {
    setFilterState((prev) => ({
      ...prev,
      states: data.overlays.filterOptions.states
    }));
  }, [data.overlays.filterOptions.states]);

  const navSections: NavSection[] = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        items: [
          { id: 'dashboard/circles', label: 'Circles', icon: <Radar className="h-5 w-5" /> },
          { id: 'dashboard/tiles', label: 'By status', icon: <Grid className="h-5 w-5" /> },
          { id: 'dashboard/path', label: 'Path analysis', icon: <Route className="h-5 w-5" /> }
        ]
      },
      {
        id: 'management',
        label: 'Management',
        items: [
          { id: 'management/groups', label: 'Groups', icon: <MapPin className="h-5 w-5" /> },
          { id: 'management/sensors', label: 'Sensors', icon: <Wifi className="h-5 w-5" /> },
          { id: 'management/agents', label: 'Agents', icon: <Users className="h-5 w-5" /> },
          { id: 'management/networks', label: 'Networks', icon: <Network className="h-5 w-5" /> },
          { id: 'management/services', label: 'Services', icon: <Settings className="h-5 w-5" /> }
        ]
      },
      {
        id: 'alerts',
        label: 'Alerts',
        items: [
          { id: 'alerts/thresholds', label: 'Thresholds', icon: <BellRing className="h-5 w-5" /> },
          { id: 'alerts/notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" /> }
        ]
      },
      {
        id: 'account',
        label: 'Account',
        items: [
          { id: 'account/reports', label: 'Reports', icon: <FileText className="h-5 w-5" /> },
          { id: 'account/aiops', label: 'AIOps', icon: <Sparkles className="h-5 w-5" /> },
          { id: 'account/subscriptions', label: 'Subscriptions', icon: <Link2 className="h-5 w-5" /> },
          { id: 'account/integrations', label: 'Integrations', icon: <Network className="h-5 w-5" /> },
          { id: 'account/profile', label: 'My profile', icon: <User className="h-5 w-5" /> },
          { id: 'account/team', label: 'Team', icon: <Users className="h-5 w-5" /> },
          { id: 'account/settings', label: 'Account', icon: <Settings className="h-5 w-5" /> }
        ]
      }
    ],
    []
  );

  const openCircleDetail = (descriptor: CircleDetailDescriptor) => {
    const resolved = resolveDetail(
      descriptor,
      data.experience.sensors,
      data.servicesCatalog.tests,
      data.internalTests,
      data.externalTests
    );
    if (resolved) {
      setDetail(resolved);
      setActiveNav('dashboard/circles');
    }
  };

  const openSensorByName = (sensorName: string) => {
    const match = data.experience.sensors.find((sensor) => sensor.name === sensorName);
    if (match) {
      setDetail({ kind: 'experience', item: match });
      setActiveNav('dashboard/circles');
    }
  };

  const tileLookup = useMemo(() => new Map(data.tiles.map((tile) => [tile.id, tile])), [data.tiles]);

  const headerTitle = (() => {
    if (activeNav === 'dashboard/circles' && detail) {
      const label = 'name' in detail.item ? detail.item.name : (detail.item as DiagnosticTest).name;
      return `${label} detail`;
    }
    switch (activeNav) {
      case 'dashboard/circles':
        return 'Experience overview';
      case 'dashboard/tiles':
        return 'Sensors by status';
      case 'dashboard/path':
        return 'Path analysis';
      case 'management/groups':
        return 'Group management';
      case 'management/sensors':
        return 'Sensor inventory';
      case 'management/agents':
        return 'Agent inventory';
      case 'management/networks':
        return 'Networks';
      case 'management/services':
        return 'Service tests';
      case 'alerts/thresholds':
        return 'Alert thresholds';
      case 'alerts/notifications':
        return 'Alert notifications';
      case 'account/reports':
        return 'Reports';
      case 'account/aiops':
        return 'AIOps';
      case 'account/subscriptions':
        return 'Subscriptions';
      case 'account/integrations':
        return 'Integrations';
      case 'account/profile':
        return 'My profile';
      case 'account/team':
        return 'Team';
      case 'account/settings':
        return 'Account settings';
      default:
        return 'Dashboard';
    }
  })();

  const headerSubtitle = (() => {
    if (activeNav === 'dashboard/circles' && detail) {
      return 'Detailed telemetry and actions';
    }
    if (activeNav.startsWith('account/')) {
      return 'Account workspace';
    }
    if (activeNav.startsWith('management/')) {
      return 'Management workspace';
    }
    if (activeNav.startsWith('alerts/')) {
      return 'Alerting workspace';
    }
    return data.generatedAt ? `Generated ${formatDateTime(data.generatedAt)}` : 'Generated n/a';
  })();

  let content: ReactNode = null;

  if (activeNav === 'dashboard/circles') {
    content = detail ? (
      <CirclesDetailView
        detail={detail}
        onBack={() => setDetail(null)}
        experienceTimeRanges={data.experience.timeRanges}
        serviceTimeRanges={data.servicesCatalog.timeRanges}
      />
    ) : (
      <CirclesDashboard
        experienceSensors={filteredExperienceSensors}
        serviceTests={filteredServiceTests}
        internalTests={filteredInternalTests}
        externalTests={filteredExternalTests}
        onOpenDetail={openCircleDetail}
      />
    );
  } else if (activeNav === 'dashboard/tiles') {
    content = (
      <TileViewByStatus
        sensors={filteredTiles}
        onSelect={(tileId) => {
          const tile = tileLookup.get(tileId);
          if (!tile) return;
          openSensorByName(tile.name);
        }}
      />
    );
  } else if (activeNav === 'dashboard/path') {
    content = <PathAnalysisSection data={data.pathAnalysis} />;
  } else if (activeNav === 'management/groups') {
    content = (
      <GroupsManagementPage
        groups={data.management.groups}
        sensors={data.management.sensors}
        agents={data.management.agents}
        networks={data.management.networks}
        services={data.management.services}
        onInspectSensor={openSensorByName}
      />
    );
  } else if (activeNav === 'management/sensors') {
    content = <SensorsManagementPage sensors={data.management.sensors} onInspect={openSensorByName} />;
  } else if (activeNav === 'management/agents') {
    content = <AgentsManagementPage agents={data.management.agents} />;
  } else if (activeNav === 'management/networks') {
    content = <NetworksManagementPage networks={data.management.networks} />;
  } else if (activeNav === 'management/services') {
    content = (
      <ServicesManagementPage
        services={data.management.services}
        diagnostics={{ internal: data.internalTests, external: data.externalTests }}
      />
    );
  } else if (activeNav === 'alerts/thresholds') {
    content = <AlertsThresholdsPage thresholds={data.alertsConfig.thresholds} />;
  } else if (activeNav === 'alerts/notifications') {
    content = (
      <AlertsNotificationsPage
        muted={data.alertsConfig.muted}
        subscriptions={data.alertsConfig.subscriptions}
        alertEmail={data.alertsConfig.alertEmail}
      />
    );
  } else if (activeNav === 'account/reports') {
    content = <ReportsPage reports={data.account.reports} />;
  } else if (activeNav === 'account/aiops') {
    content = <AiOpsPage aiops={data.account.aiops} />;
  } else if (activeNav === 'account/subscriptions') {
    content = <SubscriptionsPage subscriptions={data.account.subscriptions} />;
  } else if (activeNav === 'account/integrations') {
    content = <IntegrationsPage integrations={data.account.integrations} />;
  } else if (activeNav === 'account/profile') {
    content = <ProfilePage profile={data.account.profile} />;
  } else if (activeNav === 'account/team') {
    content = <TeamPage team={data.account.team} />;
  } else if (activeNav === 'account/settings') {
    content = <AccountSettingsPage account={data.account.account} />;
  }

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
      navSections={navSections}
      activeNav={activeNav}
      onNavigate={(pageId) => {
        setActiveNav(pageId as PageId);
        if (pageId !== 'dashboard/circles') {
          setDetail(null);
        }
      }}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
    >
      {loading && <LoadingState />}
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      {content}
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
