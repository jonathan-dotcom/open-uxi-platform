export type ServiceStatus = 'operational' | 'degraded' | 'outage';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type SensorHealthState = 'good' | 'info' | 'warning' | 'error' | 'offline';

export type SeverityLevel = 'info' | 'warning' | 'critical';

export interface TimelinePoint {
  timestamp: string;
  successRate: number;
  latencyMs: number;
}

export interface JourneySnapshot {
  id: string;
  name: string;
  successRate: number;
  responseTimeMs: number;
  status: ServiceStatus;
  impactedSites: number;
  topImpactedSensors?: string[];
}

export interface SensorPerformancePoint {
  timestamp: string;
  availability: number;
  latencyMs: number;
  jitterMs: number;
  packetLoss: number;
}

export interface Sensor {
  id: string;
  name: string;
  site: string;
  region: string;
  isp: string;
  lastCheck: string;
  availability: number;
  latencyMs: number;
  packetLoss: number;
  status: ServiceStatus;
  journeysImpacted: number;
  performance: SensorPerformancePoint[];
}

export interface SensorAction {
  id: string;
  label: string;
  description: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface ExperienceSensorOverview {
  id: string;
  name: string;
  status: SensorHealthState;
  group: string;
  location: string;
  lastUpdated: string;
  network: string;
  networkType: 'wireless' | 'wired';
  wifiDetails: {
    rssi: number;
    bitrateMbps: number;
    retryRate: number;
    channelUtilization: number;
    bssid: string;
    band: string;
    channel: string;
  };
  metrics: { label: string; value: string; helper?: string }[];
  performance: SensorPerformancePoint[];
  actions: SensorAction[];
}

export interface ServiceEvent {
  id: string;
  title: string;
  detectedAt: string;
  severity: SeverityLevel;
  rootCause: string;
  actions: SensorAction[];
}

export interface ServiceMetricSeries {
  id: string;
  label: string;
  unit: string;
  points: MetricPoint[];
}

export interface ServiceTestOverview {
  id: string;
  name: string;
  category: 'Wi-Fi' | 'DHCP' | 'Gateway' | 'DNS';
  status: SensorHealthState;
  metrics: ServiceMetricSeries[];
  ongoingEvents: ServiceEvent[];
}

export interface DiagnosticTest {
  id: string;
  name: string;
  target: string;
  status: SensorHealthState;
  latencyMs: number;
  packetLoss: number;
  jitterMs: number;
  frequency: string;
  about: string;
  metrics: ServiceMetricSeries[];
}

export interface TileSensor {
  id: string;
  name: string;
  status: SensorHealthState;
  group: string;
  network: string;
}

export interface PathHop {
  id: string;
  label: string;
  type: 'sensor' | 'provider' | 'service';
  status: SensorHealthState;
  rttMs: number;
  jitterMs: number;
  packetLoss: number;
}

export interface PathRoute {
  id: string;
  sourceGroup: string;
  sensor: string;
  destination: string;
  capturedAt: string;
  hops: PathHop[];
}

export interface PathAnalysisData {
  filters: {
    groups: string[];
    sensors: string[];
    destinations: string[];
    timeRanges: string[];
  };
  routes: PathRoute[];
}

export interface FilterOptions {
  states: SensorHealthState[];
  groups: string[];
  wirelessNetworks: string[];
  wiredNetworks: string[];
}

export interface FilterState {
  states: SensorHealthState[];
  group: string | null;
  wirelessNetwork: string | null;
  wiredNetwork: string | null;
}

export interface UpdateItem {
  id: string;
  title: string;
  body: string;
  date: string;
  category: string;
}

export interface NotificationIssue {
  id: string;
  title: string;
  severity: SeverityLevel;
  summary: string;
  network: string;
  sensor: string;
  tasks: string[];
  actions: SensorAction[];
  detectedAt: string;
}

export interface GroupManagementEntry {
  id: string;
  name: string;
  location: string;
  sensors: number;
  agents: number;
  networks: number;
  services: number;
  status: SensorHealthState;
}

export interface SensorInventoryEntry {
  id: string;
  name: string;
  serial: string;
  model: string;
  online: boolean;
  status: SensorHealthState;
  assignedGroup: string;
  dppCapable: boolean;
}

export interface AgentInventoryEntry {
  id: string;
  name: string;
  type: string;
  online: boolean;
  status: SensorHealthState;
  assignedGroup: string;
  model: string;
}

export interface NetworkEntry {
  id: string;
  name: string;
  security: string;
  ipStack: string;
  sensors: number;
  assigned: boolean;
  modifiedAt: string;
  hidden?: boolean;
  externalConnectivity?: string;
  bandLock?: string;
}

export interface ServiceInventoryEntry {
  id: string;
  name: string;
  category: string;
  target: string;
  testType: string;
  status: SensorHealthState;
  metrics: ServiceMetricSeries[];
}

export interface ThresholdSetting {
  id: string;
  name: string;
  enabled: boolean;
  warning: string;
  error: string;
}

export interface NotificationPreference {
  id: string;
  label: string;
  enabled: boolean;
  schedule: 'regular' | 'after_hours';
  severity: 'warning' | 'error';
}

export interface MuteEntry {
  id: string;
  name: string;
  mutedBy: string;
  expiresAt?: string;
}

export interface AlertsConfiguration {
  thresholds: ThresholdSetting[];
  muted: MuteEntry[];
  subscriptions: NotificationPreference[];
  alertEmail: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  schedule?: string;
  lastRun?: string;
}

export interface AccountReportWorkspace {
  onDemand: ReportDefinition[];
  scheduled: ReportDefinition[];
}

export interface AiOpsWorkspace {
  description: string;
  enabled: boolean;
  learnMoreUrl: string;
}

export interface SubscriptionEntry {
  id: string;
  service: string;
  key: string;
  subscriptions: number;
  startDate: string;
  endDate: string;
  duration: string;
}

export interface SubscriptionSummaryCard {
  headline: string;
  body: string;
  ctaLabel: string;
}

export interface SubscriptionTabData {
  summary: SubscriptionSummaryCard;
  entries: SubscriptionEntry[];
}

export interface AccountSubscriptionsWorkspace {
  sensors: SubscriptionTabData;
  agents: SubscriptionTabData;
}

export interface IntegrationEntry {
  id: string;
  name: string;
  target: string;
  status: 'connected' | 'disabled' | 'pending';
  lastUpdated: string;
}

export interface AccountIntegrationsWorkspace {
  webhooks: IntegrationEntry[];
  dataPush: IntegrationEntry[];
  centralLinked: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
}

export interface TeamMember {
  id: string;
  user: string;
  email: string;
  accessType: string;
  groupAccess: string;
}

export interface AccountDangerAction {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface AccountGlobalConfigEntry {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface AccountDetailsWorkspace {
  companyName: string;
  accountId: string;
  activationDate: string;
  sensorCount: number;
  userCount: number;
  migrationBanner: string;
  billingContact: { name: string; email: string };
  globalConfig: AccountGlobalConfigEntry[];
  auditLog: { id: string; actor: string; action: string; createdAt: string }[];
  dangerZone: AccountDangerAction[];
}

export interface AccountWorkspace {
  reports: AccountReportWorkspace;
  aiops: AiOpsWorkspace;
  subscriptions: AccountSubscriptionsWorkspace;
  integrations: AccountIntegrationsWorkspace;
  profile: UserProfile;
  team: TeamMember[];
  account: AccountDetailsWorkspace;
}

export interface AlertEvent {
  id: string;
  severity: AlertSeverity;
  summary: string;
  detectedAt: string;
  impactedJourneys: string[];
  affectedSites: number;
  acknowledged: boolean;
}

export interface DashboardSnapshot {
  generatedAt: string;
  reportingWindow: string;
  kpis: {
    globalAvailability: number;
    availabilityChange: number;
    medianLatency: number;
    latencyChange: number;
    activeIncidents: number;
    incidentChange: number;
    ingestRate: number;
    ingestChange: number;
  };
  timeline: TimelinePoint[];
  journeys: JourneySnapshot[];
  sensors: Sensor[];
  alerts: AlertEvent[];
  experience: {
    timeRanges: string[];
    sensors: ExperienceSensorOverview[];
  };
  servicesCatalog: {
    timeRanges: string[];
    tests: ServiceTestOverview[];
  };
  internalTests: DiagnosticTest[];
  externalTests: DiagnosticTest[];
  tiles: TileSensor[];
  pathAnalysis: PathAnalysisData;
  overlays: {
    updates: UpdateItem[];
    notifications: NotificationIssue[];
    filterOptions: FilterOptions;
  };
  management: {
    groups: GroupManagementEntry[];
    sensors: SensorInventoryEntry[];
    agents: AgentInventoryEntry[];
    networks: {
      wireless: NetworkEntry[];
      wired: NetworkEntry[];
    };
    services: ServiceInventoryEntry[];
  };
  alertsConfig: AlertsConfiguration;
  account: AccountWorkspace;
  counts: {
    sensorsOnline: number;
    agentsOnline: number;
  };
}
