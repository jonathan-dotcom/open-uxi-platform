import type {
  DashboardSnapshot,
  DiagnosticTest,
  ExperienceSensorOverview,
  MetricPoint,
  NotificationIssue,
  PathRoute,
  Sensor,
  SensorAction,
  SensorPerformancePoint,
  ServiceEvent,
  ServiceMetricSeries,
  ServiceStatus,
  ServiceTestOverview,
  ThresholdSetting,
  TimelinePoint,
  TileSensor,
  UpdateItem
} from '../types';

function hoursAgo(base: string, hours: number): string {
  return new Date(new Date(base).getTime() - hours * 60 * 60 * 1000).toISOString();
}

function buildTimeline(windowEnd: string): TimelinePoint[] {
  return Array.from({ length: 12 }).map((_, index) => {
    const timestamp = hoursAgo(windowEnd, 11 - index);
    const successRate = 99 - Math.abs(6 - index) * 0.7 + Math.random() * 1.1;
    const latencyMs = 60 + Math.sin(index / 1.5) * 30 + Math.random() * 6;
    return {
      timestamp,
      successRate: Number(successRate.toFixed(1)),
      latencyMs: Number(latencyMs.toFixed(0))
    };
  });
}

function buildPerformance(
  windowEnd: string,
  baselineAvailability: number,
  baselineLatency: number,
  spikeIndex: number
): SensorPerformancePoint[] {
  return Array.from({ length: 12 }).map((_, index) => {
    const timestamp = hoursAgo(windowEnd, 11 - index);
    const availability = baselineAvailability - Math.max(0, spikeIndex - index) * 0.35 + Math.random() * 0.2;
    const latencyMs = baselineLatency + Math.sin(index / 1.3) * 18 + (index === spikeIndex ? 45 : 0) + Math.random() * 4;
    const packetLoss = Math.max(0, (latencyMs - baselineLatency) / 250);
    const jitterMs = 6 + Math.abs(Math.sin(index)) * 6;
    return {
      timestamp,
      availability: Number(Math.max(80, Math.min(availability, 100)).toFixed(2)),
      latencyMs: Number(Math.max(20, latencyMs).toFixed(0)),
      jitterMs: Number(jitterMs.toFixed(0)),
      packetLoss: Number(packetLoss.toFixed(2))
    };
  });
}

function sensorStatus(availability: number): ServiceStatus {
  if (availability >= 99) return 'operational';
  if (availability >= 96) return 'degraded';
  return 'outage';
}

function buildMetricSeries(
  id: string,
  label: string,
  unit: string,
  baseValue: number,
  variance: number,
  windowEnd: string,
  formatter: (value: number) => number = (value) => Number(value.toFixed(unit === '%' ? 1 : 0))
): ServiceMetricSeries {
  const points: MetricPoint[] = Array.from({ length: 12 }).map((_, index) => {
    const timestamp = hoursAgo(windowEnd, 11 - index);
    const magnitude = baseValue + Math.sin(index / 1.7) * variance + Math.random() * variance * 0.4;
    return {
      timestamp,
      value: formatter(magnitude)
    };
  });
  return { id, label, unit, points };
}

function buildServiceEvent(
  id: string,
  title: string,
  detectedAt: string,
  severity: 'info' | 'warning' | 'critical',
  rootCause: string,
  actions: SensorAction[]
): ServiceEvent {
  return { id, title, detectedAt, severity, rootCause, actions };
}

const generatedAt = '2024-03-15T09:35:00Z';

const experienceSensors: ExperienceSensorOverview[] = [
  {
    id: 'exp-ams-01',
    name: 'AMS-01',
    status: 'good',
    group: 'Global HQ',
    location: 'Amsterdam HQ',
    lastUpdated: '2024-03-15T09:32:00Z',
    network: 'Corporate Wi-Fi',
    networkType: 'wireless' as const,
    wifiDetails: {
      rssi: -62,
      bitrateMbps: 780,
      retryRate: 4.2,
      channelUtilization: 32,
      bssid: '6c:8b:2f:11:cd:20',
      band: '5 GHz',
      channel: '44'
    },
    metrics: [
      { label: 'RSSI', value: '-62 dBm' },
      { label: 'Bitrate', value: '780 Mbps', helper: '80 MHz channel width' },
      { label: 'Retry rate', value: '4.2 %' },
      { label: 'Channel util.', value: '32 %' },
      { label: 'BSSID', value: '6c:8b:2f:11:cd:20' },
      { label: 'Band', value: '5 GHz' }
    ],
    performance: buildPerformance(generatedAt, 99.6, 45, 3),
    actions: [
      { id: 'raw-data', label: 'Download raw data', description: 'Export last 60 minutes of RF telemetry.' },
      { id: 'pcap', label: 'Request PCAP', description: 'Capture 5-minute packet trace on wlan0.' },
      { id: 'reboot', label: 'Reboot sensor', description: 'Gracefully restart after active tests finish.' }
    ]
  },
  {
    id: 'exp-nyc-02',
    name: 'NYC-02',
    status: 'warning',
    group: 'US East',
    location: 'New York Hub',
    lastUpdated: '2024-03-15T09:31:12Z',
    network: 'Retail Wi-Fi',
    networkType: 'wireless' as const,
    wifiDetails: {
      rssi: -71,
      bitrateMbps: 420,
      retryRate: 11.6,
      channelUtilization: 66,
      bssid: 'ac:1f:72:90:fe:01',
      band: '5 GHz',
      channel: '149'
    },
    metrics: [
      { label: 'RSSI', value: '-71 dBm', helper: 'Warning threshold: -70 dBm' },
      { label: 'Bitrate', value: '420 Mbps' },
      { label: 'Retry rate', value: '11.6 %', helper: 'Above policy threshold' },
      { label: 'Channel util.', value: '66 %' },
      { label: 'BSSID', value: 'ac:1f:72:90:fe:01' },
      { label: 'Band', value: '5 GHz' }
    ],
    performance: buildPerformance(generatedAt, 98.1, 78, 7),
    actions: [
      { id: 'raw-data', label: 'Download raw data', description: 'Export 500MB telemetry archive.' },
      { id: 'pcap', label: 'Request PCAP', description: 'Trigger targeted capture on SSID Retail-5G.' },
      { id: 'reboot', label: 'Reboot sensor', description: 'Immediate reboot requested by NYC operations.' }
    ]
  },
  {
    id: 'exp-sfo-03',
    name: 'SFO-03',
    status: 'error',
    group: 'US West',
    location: 'San Francisco Edge',
    lastUpdated: '2024-03-15T09:30:48Z',
    network: 'Corporate Wi-Fi',
    networkType: 'wireless' as const,
    wifiDetails: {
      rssi: -84,
      bitrateMbps: 96,
      retryRate: 24.8,
      channelUtilization: 92,
      bssid: '7a:2f:89:33:ab:10',
      band: '2.4 GHz',
      channel: '6'
    },
    metrics: [
      { label: 'RSSI', value: '-84 dBm', helper: 'Error threshold: -80 dBm' },
      { label: 'Bitrate', value: '96 Mbps' },
      { label: 'Retry rate', value: '24.8 %' },
      { label: 'Channel util.', value: '92 %' },
      { label: 'BSSID', value: '7a:2f:89:33:ab:10' },
      { label: 'Band', value: '2.4 GHz' }
    ],
    performance: buildPerformance(generatedAt, 96.5, 101, 5),
    actions: [
      { id: 'raw-data', label: 'Download raw data', description: 'Attach logs to Salesforce incident INC-9981.' },
      { id: 'pcap', label: 'Request PCAP', description: 'Escalated capture with channel hop disabled.' },
      { id: 'reboot', label: 'Reboot sensor', description: 'Hold reboot until capture completes.' }
    ]
  },
  {
    id: 'exp-sin-01',
    name: 'SIN-01',
    status: 'offline',
    group: 'APAC',
    location: 'Singapore Regional',
    lastUpdated: '2024-03-15T08:52:11Z',
    network: 'Corporate Wired',
    networkType: 'wired' as const,
    wifiDetails: {
      rssi: -99,
      bitrateMbps: 0,
      retryRate: 0,
      channelUtilization: 0,
      bssid: '--',
      band: 'N/A',
      channel: '--'
    },
    metrics: [
      { label: 'Status', value: 'Offline', helper: 'No heartbeat in 42 minutes' },
      { label: 'Last IP', value: '10.22.4.36' },
      { label: 'Band lock', value: 'Dual-band' },
      { label: 'Network', value: 'Corporate Wired' }
    ],
    performance: buildPerformance(generatedAt, 91.5, 180, 4),
    actions: [
      { id: 'raw-data', label: 'Download last snapshot', description: 'Use cached payload from last heartbeat.' },
      { id: 'reboot', label: 'Power cycle request', description: 'Send remote PoE bounce via Meraki switch.' }
    ]
  }
];

const serviceTests: ServiceTestOverview[] = [
  {
    id: 'svc-wifi',
    name: 'Wi-Fi Association',
    category: 'Wi-Fi',
    status: 'good',
    metrics: [
      buildMetricSeries('assoc', 'Association success', '%', 98.6, 1.2, generatedAt),
      buildMetricSeries('auth', 'Auth time', 'ms', 180, 22, generatedAt)
    ],
    ongoingEvents: [
      buildServiceEvent(
        'svc-wifi-event-1',
        'Proactive optimization applied',
        '2024-03-15T07:45:00Z',
        'info',
        'Channel plan rebalanced after DFS radar event.',
        [
          { id: 'view-plan', label: 'View channel plan', description: 'Open RF planning recommendation.' },
          { id: 'export', label: 'Export issue report', description: 'Download PDF summary for stakeholders.' }
        ]
      )
    ]
  },
  {
    id: 'svc-dhcp',
    name: 'DHCP Lease',
    category: 'DHCP',
    status: 'warning',
    metrics: [
      buildMetricSeries('lease-time', 'Lease time', 'ms', 820, 120, generatedAt),
      buildMetricSeries('success', 'Success rate', '%', 97.1, 1.6, generatedAt)
    ],
    ongoingEvents: [
      buildServiceEvent(
        'svc-dhcp-event-1',
        'Lease timeouts observed',
        '2024-03-15T08:05:00Z',
        'warning',
        'Two NYC scopes depleted. Renewal attempts retried three times.',
        [
          { id: 'download-pcap', label: 'Download PCAP', description: 'DHCP discover/offer exchange capture.' },
          { id: 'open-runbook', label: 'View runbook', description: 'Scope expansion playbook for NYC hub.' }
        ]
      )
    ]
  },
  {
    id: 'svc-gateway',
    name: 'Gateway Reachability',
    category: 'Gateway',
    status: 'error',
    metrics: [
      buildMetricSeries('gateway-rtt', 'RTT', 'ms', 64, 28, generatedAt),
      buildMetricSeries('gateway-loss', 'Packet loss', '%', 4.4, 1.1, generatedAt, (value) => Number(value.toFixed(2)))
    ],
    ongoingEvents: [
      buildServiceEvent(
        'svc-gateway-event-1',
        'ISP congestion detected',
        '2024-03-15T08:41:00Z',
        'critical',
        'Comcast Business link experiencing 12% loss at hop 3.',
        [
          { id: 'share-issue', label: 'Share issue', description: 'Send outage digest to incident room.' },
          { id: 'download-pcap', label: 'Download PCAP', description: 'Capture from impacted SFO-03 sensor.' }
        ]
      )
    ]
  },
  {
    id: 'svc-dns',
    name: 'DNS Resolution',
    category: 'DNS',
    status: 'good',
    metrics: [
      buildMetricSeries('dns-latency', 'Query time', 'ms', 48, 10, generatedAt),
      buildMetricSeries('dns-success', 'Success rate', '%', 99.4, 0.5, generatedAt)
    ],
    ongoingEvents: []
  }
];

const internalTests: DiagnosticTest[] = [
  {
    id: 'internal-core',
    name: 'Core services VLAN',
    target: '10.1.12.5',
    status: 'good',
    latencyMs: 14,
    packetLoss: 0,
    jitterMs: 1,
    frequency: 'Every 60 seconds',
    about: 'ICMP test validating backbone gateway availability in the Amsterdam DC.',
    metrics: [buildMetricSeries('internal-rtt', 'RTT', 'ms', 14, 3, generatedAt)]
  },
  {
    id: 'internal-finance',
    name: 'Finance application',
    target: '10.32.88.40',
    status: 'warning',
    latencyMs: 86,
    packetLoss: 0.6,
    jitterMs: 8,
    frequency: 'Every 2 minutes',
    about: 'Validates SAP gateway reachability from NYC-02 with 3 retry attempts.',
    metrics: [
      buildMetricSeries('internal-finance-rtt', 'RTT', 'ms', 82, 24, generatedAt),
      buildMetricSeries('internal-finance-loss', 'Packet loss', '%', 0.8, 0.4, generatedAt, (value) => Number(value.toFixed(2)))
    ]
  }
];

const externalTests: DiagnosticTest[] = [
  {
    id: 'external-google',
    name: 'Google Workspace',
    target: 'workspace.google.com',
    status: 'good',
    latencyMs: 112,
    packetLoss: 0.2,
    jitterMs: 6,
    frequency: 'Every 5 minutes',
    about: 'HTTP GET login workflow executed from AMS-01 and NYC-02 sensors.',
    metrics: [
      buildMetricSeries('google-rtt', 'RTT', 'ms', 110, 16, generatedAt),
      buildMetricSeries('google-http', 'HTTP GET', 'ms', 420, 60, generatedAt)
    ]
  },
  {
    id: 'external-github',
    name: 'GitHub API',
    target: 'api.github.com',
    status: 'error',
    latencyMs: 262,
    packetLoss: 2.8,
    jitterMs: 22,
    frequency: 'Every 5 minutes',
    about: 'Monitors REST API latency from SFO-03 and SIN-01 sensors with OAuth tokens.',
    metrics: [
      buildMetricSeries('github-rtt', 'RTT', 'ms', 250, 40, generatedAt),
      buildMetricSeries('github-loss', 'Packet loss', '%', 2.4, 0.7, generatedAt, (value) => Number(value.toFixed(2)))
    ]
  }
];

const tiles: TileSensor[] = [
  { id: 'tile-ams-01', name: 'AMS-01', status: 'good', group: 'Global HQ', network: 'Corporate Wi-Fi' },
  { id: 'tile-nyc-02', name: 'NYC-02', status: 'warning', group: 'US East', network: 'Retail Wi-Fi' },
  { id: 'tile-sfo-03', name: 'SFO-03', status: 'error', group: 'US West', network: 'Corporate Wi-Fi' },
  { id: 'tile-sin-01', name: 'SIN-01', status: 'offline', group: 'APAC', network: 'Corporate Wired' },
  { id: 'tile-mob-01', name: 'Mobile-APAC', status: 'info', group: 'APAC Field', network: '4G Test' }
];

const pathRoutes: PathRoute[] = [
  {
    id: 'path-zoom',
    sourceGroup: 'Global HQ',
    sensor: 'AMS-01',
    destination: 'Zoom Video',
    capturedAt: '2024-03-15T09:20:00Z',
    hops: [
      { id: 'hop-1', label: 'AMS-01 Sensor', type: 'sensor', status: 'good', rttMs: 4, jitterMs: 1, packetLoss: 0 },
      { id: 'hop-2', label: 'KPN Edge', type: 'provider', status: 'good', rttMs: 18, jitterMs: 2, packetLoss: 0 },
      { id: 'hop-3', label: 'Cloudflare WAF', type: 'provider', status: 'info', rttMs: 36, jitterMs: 5, packetLoss: 0.2 },
      { id: 'hop-4', label: 'Zoom Front Door', type: 'service', status: 'good', rttMs: 54, jitterMs: 6, packetLoss: 0.1 }
    ]
  },
  {
    id: 'path-github',
    sourceGroup: 'US West',
    sensor: 'SFO-03',
    destination: 'GitHub API',
    capturedAt: '2024-03-15T09:12:00Z',
    hops: [
      { id: 'hop-1', label: 'SFO-03 Sensor', type: 'sensor', status: 'warning', rttMs: 12, jitterMs: 4, packetLoss: 0.6 },
      { id: 'hop-2', label: 'Comcast Edge', type: 'provider', status: 'error', rttMs: 78, jitterMs: 14, packetLoss: 3.2 },
      { id: 'hop-3', label: 'Equinix IX', type: 'provider', status: 'warning', rttMs: 126, jitterMs: 18, packetLoss: 1.4 },
      { id: 'hop-4', label: 'GitHub API', type: 'service', status: 'error', rttMs: 262, jitterMs: 22, packetLoss: 2.8 }
    ]
  }
];

const updates: UpdateItem[] = [
  {
    id: 'update-1',
    title: 'Dynamic Path Analysis',
    body: 'New hop grouping controls shipped with percentile-based RTT insights.',
    date: '2024-03-11',
    category: 'Feature'
  },
  {
    id: 'update-2',
    title: 'Mobile Agent Beta',
    body: 'Android agents now support Wi-Fi 6E radios with remote capture.',
    date: '2024-03-07',
    category: 'Beta'
  },
  {
    id: 'update-3',
    title: 'Service automation',
    body: 'Automatically open Jira tickets from failing service tests.',
    date: '2024-02-28',
    category: 'Automation'
  }
];

const notifications: NotificationIssue[] = [
  {
    id: 'notif-1',
    title: 'Gateway reachability degraded',
    severity: 'critical',
    summary: 'SFO-03 observing 12% packet loss towards default gateway.',
    network: 'Corporate Wi-Fi',
    sensor: 'SFO-03',
    tasks: ['Collect PCAP', 'Review ISP status page'],
    actions: [
      { id: 'notif-pcap', label: 'Download PCAP', description: 'Triggered from SFO-03 at 09:15 UTC.' },
      { id: 'notif-share', label: 'Share issue', description: 'Send summary to Slack #net-ops.' }
    ],
    detectedAt: '2024-03-15T08:45:00Z'
  },
  {
    id: 'notif-2',
    title: 'DHCP renewals slow',
    severity: 'warning',
    summary: 'NYC-02 recorded 4 lease retries in the last 30 minutes.',
    network: 'Retail Wi-Fi',
    sensor: 'NYC-02',
    tasks: ['Increase lease pool', 'Verify helper IPs'],
    actions: [
      { id: 'notif-export', label: 'Export report', description: 'Generate PDF for incident bridge.' }
    ],
    detectedAt: '2024-03-15T08:22:00Z'
  }
];

const groupThresholds: ThresholdSetting[] = [
  { id: 'th-rssi-low', name: 'RSSI low', enabled: true, warning: 'Average RSSI < -70 dBm for 5 min', error: 'Average RSSI < -78 dBm for 5 min' },
  { id: 'th-rssi-drop', name: 'RSSI drop', enabled: true, warning: 'Drop > 10 dBm within 5 min', error: 'Drop > 15 dBm within 5 min' },
  { id: 'th-bitrate', name: 'Low bitrate', enabled: true, warning: 'Bitrate < 250 Mbps for 10 min', error: 'Bitrate < 100 Mbps for 10 min' },
  { id: 'th-retry', name: 'Retry rate', enabled: true, warning: 'Retry rate > 12 %', error: 'Retry rate > 20 %' },
  { id: 'th-channel', name: 'Channel utilization', enabled: false, warning: 'Utilization > 70 %', error: 'Utilization > 85 %' }
];

const fallbackDashboard: DashboardSnapshot = {
  generatedAt,
  reportingWindow: 'Last 12 hours',
  kpis: {
    globalAvailability: 98.4,
    availabilityChange: 0.8,
    medianLatency: 62,
    latencyChange: -3.1,
    activeIncidents: 3,
    incidentChange: 1.2,
    ingestRate: 1800,
    ingestChange: 4.5
  },
  timeline: buildTimeline(generatedAt),
  journeys: [
    {
      id: 'journey-zoom',
      name: 'Zoom Video',
      successRate: 99.1,
      responseTimeMs: 248,
      status: 'operational',
      impactedSites: 0,
      topImpactedSensors: []
    },
    {
      id: 'journey-o365',
      name: 'Office 365',
      successRate: 94.3,
      responseTimeMs: 612,
      status: 'degraded',
      impactedSites: 2,
      topImpactedSensors: ['NYC-02', 'SFO-03']
    },
    {
      id: 'journey-salesforce',
      name: 'Salesforce',
      successRate: 88.7,
      responseTimeMs: 954,
      status: 'outage',
      impactedSites: 4,
      topImpactedSensors: ['SIN-01', 'SFO-03', 'NYC-02']
    }
  ],
  sensors: [
    {
      id: 'sensor-ams-01',
      name: 'AMS-01',
      site: 'Amsterdam HQ',
      region: 'EMEA',
      isp: 'KPN',
      lastCheck: '2024-03-15T09:32:00Z',
      availability: 99.93,
      latencyMs: 46,
      packetLoss: 0.1,
      status: sensorStatus(99.93),
      journeysImpacted: 0,
      performance: buildPerformance(generatedAt, 99.6, 45, 3)
    },
    {
      id: 'sensor-nyc-02',
      name: 'NYC-02',
      site: 'New York Hub',
      region: 'Americas',
      isp: 'Verizon Fios',
      lastCheck: '2024-03-15T09:31:22Z',
      availability: 98.65,
      latencyMs: 82,
      packetLoss: 0.4,
      status: sensorStatus(98.65),
      journeysImpacted: 2,
      performance: buildPerformance(generatedAt, 98.1, 78, 7)
    },
    {
      id: 'sensor-sfo-03',
      name: 'SFO-03',
      site: 'San Francisco Edge',
      region: 'Americas',
      isp: 'Comcast Business',
      lastCheck: '2024-03-15T09:33:48Z',
      availability: 97.12,
      latencyMs: 105,
      packetLoss: 0.9,
      status: sensorStatus(97.12),
      journeysImpacted: 3,
      performance: buildPerformance(generatedAt, 96.5, 101, 5)
    },
    {
      id: 'sensor-sin-01',
      name: 'SIN-01',
      site: 'Singapore Regional',
      region: 'APAC',
      isp: 'SingTel',
      lastCheck: '2024-03-15T09:30:11Z',
      availability: 92.4,
      latencyMs: 188,
      packetLoss: 2.4,
      status: sensorStatus(92.4),
      journeysImpacted: 4,
      performance: buildPerformance(generatedAt, 91.5, 180, 4)
    }
  ],
  alerts: [
    {
      id: 'alert-salesforce',
      severity: 'critical',
      summary: 'Salesforce auth failures detected from 4 regions',
      detectedAt: '2024-03-15T08:52:00Z',
      impactedJourneys: ['Salesforce'],
      affectedSites: 4,
      acknowledged: false
    },
    {
      id: 'alert-wifi',
      severity: 'warning',
      summary: 'Wi-Fi saturation at San Francisco Edge',
      detectedAt: '2024-03-15T07:41:00Z',
      impactedJourneys: ['Office 365'],
      affectedSites: 1,
      acknowledged: true
    },
    {
      id: 'alert-sdwan',
      severity: 'info',
      summary: 'SD-WAN policy update applied to Amsterdam HQ',
      detectedAt: '2024-03-15T06:05:00Z',
      impactedJourneys: [],
      affectedSites: 1,
      acknowledged: true
    }
  ],
  experience: {
    timeRanges: ['Last 60 minutes', 'Last 24 hours', 'Last 7 days'],
    sensors: experienceSensors
  },
  servicesCatalog: {
    timeRanges: ['Last 60 minutes', 'Last 24 hours', 'Last 7 days'],
    tests: serviceTests
  },
  internalTests,
  externalTests,
  tiles,
  pathAnalysis: {
    filters: {
      groups: ['Global HQ', 'US East', 'US West', 'APAC', 'APAC Field'],
      sensors: ['AMS-01', 'NYC-02', 'SFO-03', 'SIN-01', 'Mobile-APAC'],
      destinations: ['Zoom Video', 'Office 365', 'Salesforce', 'GitHub API', 'Google Workspace'],
      timeRanges: ['Last 15 minutes', 'Last hour', 'Last 24 hours']
    },
    routes: pathRoutes
  },
  overlays: {
    updates,
    notifications,
    filterOptions: {
      states: ['good', 'info', 'warning', 'error', 'offline'],
      groups: ['Global HQ', 'US East', 'US West', 'APAC', 'APAC Field'],
      wirelessNetworks: ['Corporate Wi-Fi', 'Retail Wi-Fi', 'Guest Wi-Fi'],
      wiredNetworks: ['Corporate Wired', 'Data Center Core']
    }
  },
  management: {
    groups: [
      { id: 'group-hq', name: 'Global HQ', location: 'Amsterdam, NL', sensors: 6, agents: 2, networks: 4, services: 12, status: 'good' },
      { id: 'group-east', name: 'US East', location: 'New York, US', sensors: 8, agents: 3, networks: 5, services: 14, status: 'warning' },
      { id: 'group-apac', name: 'APAC', location: 'Singapore, SG', sensors: 5, agents: 1, networks: 3, services: 9, status: 'error' }
    ],
    sensors: [
      { id: 'inv-ams-01', name: 'AMS-01', serial: 'UXI100234', model: 'UXI Sensor X', online: true, status: 'good', assignedGroup: 'Global HQ', dppCapable: true },
      { id: 'inv-nyc-02', name: 'NYC-02', serial: 'UXI100512', model: 'UXI Sensor X', online: true, status: 'warning', assignedGroup: 'US East', dppCapable: true },
      { id: 'inv-sfo-03', name: 'SFO-03', serial: 'UXI100889', model: 'UXI Sensor X', online: true, status: 'error', assignedGroup: 'US West', dppCapable: false },
      { id: 'inv-sin-01', name: 'SIN-01', serial: 'UXI100901', model: 'UXI Sensor X', online: false, status: 'offline', assignedGroup: 'APAC', dppCapable: true }
    ],
    agents: [
      { id: 'agent-1', name: 'Mobile-APAC', type: 'Android Agent', online: true, status: 'info', assignedGroup: 'APAC Field', model: 'vivo V2050' },
      { id: 'agent-2', name: 'Field-US', type: 'iOS Agent', online: false, status: 'offline', assignedGroup: 'US East', model: 'iPhone 14' }
    ],
    networks: {
      wireless: [
        { id: 'net-wifi-1', name: 'Corporate Wi-Fi', security: 'WPA2-Enterprise', ipStack: 'Dual stack', sensors: 12, assigned: true, modifiedAt: '2024-03-14', hidden: false, externalConnectivity: 'Full', bandLock: '5 GHz preferred' },
        { id: 'net-wifi-2', name: 'Retail Wi-Fi', security: 'WPA2-Personal', ipStack: 'IPv4', sensors: 6, assigned: true, modifiedAt: '2024-03-13', hidden: false, externalConnectivity: 'Restricted', bandLock: 'Dual-band' }
      ],
      wired: [
        { id: 'net-wired-1', name: 'Corporate Wired', security: '802.1X', ipStack: 'Dual stack', sensors: 10, assigned: true, modifiedAt: '2024-03-12' },
        { id: 'net-wired-2', name: 'Data Center Core', security: '802.1X', ipStack: 'IPv6', sensors: 4, assigned: false, modifiedAt: '2024-03-10' }
      ]
    },
    services: [
      {
        id: 'svc-internal-core',
        name: 'Core services VLAN',
        category: 'Internal',
        target: '10.1.12.5',
        testType: 'ICMP',
        status: 'good',
        metrics: [buildMetricSeries('svc-core-rtt', 'Latency', 'ms', 14, 4, generatedAt)]
      },
      {
        id: 'svc-google',
        name: 'Google Workspace',
        category: 'External',
        target: 'workspace.google.com',
        testType: 'HTTP GET',
        status: 'good',
        metrics: [buildMetricSeries('svc-google-rtt', 'Latency', 'ms', 112, 18, generatedAt)]
      },
      {
        id: 'svc-github',
        name: 'GitHub API',
        category: 'External',
        target: 'api.github.com',
        testType: 'HTTP GET',
        status: 'error',
        metrics: [buildMetricSeries('svc-github-rtt', 'Latency', 'ms', 250, 45, generatedAt)]
      }
    ]
  },
  alertsConfig: {
    thresholds: groupThresholds,
    muted: [{ id: 'mute-1', name: 'Guest Wi-Fi RSSI low', mutedBy: 'Alex Rivera', expiresAt: '2024-03-18T00:00:00Z' }],
    subscriptions: [
      { id: 'sub-1', label: 'Email on error', enabled: true, schedule: 'regular', severity: 'error' },
      { id: 'sub-2', label: 'Email on warning (after hours)', enabled: false, schedule: 'after_hours', severity: 'warning' }
    ],
    alertEmail: 'network-ops@example.com'
  },
  counts: {
    sensorsOnline: 18,
    agentsOnline: 3
  }
};

export { fallbackDashboard };
export type { ServiceStatus };
