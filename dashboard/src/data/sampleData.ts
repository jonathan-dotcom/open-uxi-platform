import type {
  DashboardSnapshot,
  SensorPerformancePoint,
  ServiceStatus,
  TimelinePoint
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

const generatedAt = '2024-03-15T09:35:00Z';

export const fallbackDashboard: DashboardSnapshot = {
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
  ]
};

export type { ServiceStatus };
