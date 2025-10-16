export type ServiceStatus = 'operational' | 'degraded' | 'outage';

export interface Sensor {
  id: string;
  name: string;
  site: string;
  lastCheck: string;
  availability: number;
  latencyMs: number;
  status: ServiceStatus;
}

export interface JourneySnapshot {
  id: string;
  name: string;
  successRate: number;
  responseTimeMs: number;
  status: ServiceStatus;
  impactedSites: number;
}

export interface TimelinePoint {
  timestamp: string;
  successRate: number;
  latencyMs: number;
}

export const sensors: Sensor[] = [
  {
    id: 'sensor-ams-01',
    name: 'AMS-01',
    site: 'Amsterdam HQ',
    lastCheck: '2024-03-15T09:32:00Z',
    availability: 99.93,
    latencyMs: 46,
    status: 'operational'
  },
  {
    id: 'sensor-nyc-02',
    name: 'NYC-02',
    site: 'New York Hub',
    lastCheck: '2024-03-15T09:31:22Z',
    availability: 98.65,
    latencyMs: 82,
    status: 'degraded'
  },
  {
    id: 'sensor-sfo-03',
    name: 'SFO-03',
    site: 'San Francisco Edge',
    lastCheck: '2024-03-15T09:33:48Z',
    availability: 97.12,
    latencyMs: 105,
    status: 'degraded'
  },
  {
    id: 'sensor-sin-01',
    name: 'SIN-01',
    site: 'Singapore Regional',
    lastCheck: '2024-03-15T09:30:11Z',
    availability: 92.4,
    latencyMs: 188,
    status: 'outage'
  }
];

export const journeys: JourneySnapshot[] = [
  {
    id: 'journey-zoom',
    name: 'Zoom Video',
    successRate: 99.1,
    responseTimeMs: 248,
    status: 'operational',
    impactedSites: 0
  },
  {
    id: 'journey-o365',
    name: 'Office 365',
    successRate: 94.3,
    responseTimeMs: 612,
    status: 'degraded',
    impactedSites: 2
  },
  {
    id: 'journey-salesforce',
    name: 'Salesforce',
    successRate: 88.7,
    responseTimeMs: 954,
    status: 'outage',
    impactedSites: 4
  }
];

export const timeline: TimelinePoint[] = Array.from({ length: 12 }).map((_, index) => {
  const base = new Date('2024-03-15T00:00:00Z').getTime();
  const timestamp = new Date(base + index * 60 * 60 * 1000).toISOString();
  const successRate = 98 - Math.abs(5 - index) * 0.6 + Math.random() * 1.2;
  const latencyMs = 60 + Math.sin(index / 2) * 25 + Math.random() * 5;
  return { timestamp, successRate: Number(successRate.toFixed(1)), latencyMs: Number(latencyMs.toFixed(0)) };
});
