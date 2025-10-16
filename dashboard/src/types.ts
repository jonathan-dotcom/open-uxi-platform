export type ServiceStatus = 'operational' | 'degraded' | 'outage';

export type AlertSeverity = 'critical' | 'warning' | 'info';

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
}
