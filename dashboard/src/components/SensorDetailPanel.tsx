import { Activity, Globe2, Network, Wifi } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis } from 'recharts';
import type { Sensor } from '../types';
import { Card } from './common/Card';
import { formatDateTime, formatPercent, formatTime } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface SensorDetailPanelProps {
  sensor: Sensor | null;
}

export function SensorDetailPanel({ sensor }: SensorDetailPanelProps) {
  if (!sensor) {
    return (
      <Card
        title="Select a sensor"
        description="Choose a sensor from the table to review its synthetic telemetry and recent health."
      >
        <p className="text-sm text-white/60">Sensor trends will appear here when a sensor is selected.</p>
      </Card>
    );
  }

  return (
    <Card
      title={`${sensor.name} · ${sensor.site}`}
      description={`ISP ${sensor.isp} · Region ${sensor.region}`}
      action={<StatusBadge status={sensor.status} />}
    >
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <Wifi className="h-4 w-4" /> Availability
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{formatPercent(sensor.availability, 2)}</p>
          <p className="text-xs text-white/50">Last 7 checks</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <Activity className="h-4 w-4" /> Latency
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{sensor.latencyMs.toFixed(0)} ms</p>
          <p className="text-xs text-white/50">Median of synthetic journey</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <Globe2 className="h-4 w-4" /> Packet loss
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{sensor.packetLoss.toFixed(1)}%</p>
          <p className="text-xs text-white/50">Across WAN hop</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <Network className="h-4 w-4" /> Journeys impacted
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{sensor.journeysImpacted}</p>
          <p className="text-xs text-white/50">Synthetic workflows with issues</p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Availability trend</h3>
          <div className="mt-4 h-60 w-full rounded-xl border border-white/5 bg-surface/60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sensor.performance} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sensorAvailability" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(value)} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(17, 28, 61, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  labelFormatter={(value) => formatTime(String(value))}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Availability']}
                />
                <Area type="monotone" dataKey="availability" stroke="#22c55e" fill="url(#sensorAvailability)" name="Availability" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Latest check</h3>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="text-xs uppercase tracking-wide text-white/50">Completed</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatDateTime(sensor.lastCheck)}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-white/50">Next steps</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              <li>Validate upstream ISP {sensor.isp} for packet loss trends.</li>
              <li>Review impacted journeys ({sensor.journeysImpacted}) for correlated SaaS outages.</li>
              <li>Schedule Wi-Fi spectrum capture if degradation persists.</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
