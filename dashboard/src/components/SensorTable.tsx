import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, Filter, Search } from 'lucide-react';
import type { Sensor, ServiceStatus } from '../types';
import { StatusBadge } from './StatusBadge';

const sorters: Record<string, (a: Sensor, b: Sensor) => number> = {
  site: (a, b) => a.site.localeCompare(b.site),
  availability: (a, b) => b.availability - a.availability,
  latency: (a, b) => a.latencyMs - b.latencyMs,
  packetLoss: (a, b) => a.packetLoss - b.packetLoss
};

interface SensorTableProps {
  sensors: Sensor[];
  selectedSensorId: string | null;
  onSelect: (sensorId: string) => void;
}

export function SensorTable({ sensors, selectedSensorId, onSelect }: SensorTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof typeof sorters>('availability');
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceStatus>('all');
  const [regionFilter, setRegionFilter] = useState<'all' | string>('all');

  const regions = useMemo(() => Array.from(new Set(sensors.map((sensor) => sensor.region))).sort(), [sensors]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sensors
      .filter((sensor) => sensor.name.toLowerCase().includes(term) || sensor.site.toLowerCase().includes(term))
      .filter((sensor) => (statusFilter === 'all' ? true : sensor.status === statusFilter))
      .filter((sensor) => (regionFilter === 'all' ? true : sensor.region === regionFilter))
      .sort(sorters[sortKey]);
  }, [sensors, searchTerm, sortKey, statusFilter, regionFilter]);

  return (
    <section id="sensors" className="mt-12 rounded-2xl border border-white/5 bg-surface/80 p-6 shadow-card">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Sensor fleet</h2>
          <p className="text-sm text-white/60">Heartbeat, availability, and latency across your estate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <Search className="h-4 w-4 text-white/40" />
            <input
              className="bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              placeholder="Search sensors"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Filter className="h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ServiceStatus)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="outage">Outage</option>
            </select>
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value as 'all' | string)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white focus:outline-none"
            >
              <option value="all">All regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() =>
              setSortKey((current) =>
                current === 'availability' ? 'latency' : current === 'latency' ? 'packetLoss' : current === 'packetLoss' ? 'site' : 'availability'
              )
            }
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
          >
            Sort {sortKey} <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="mt-6 overflow-hidden rounded-xl border border-white/5">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Sensor</th>
              <th className="px-4 py-3 text-left font-medium">Site</th>
              <th className="px-4 py-3 text-left font-medium">Region</th>
              <th className="px-4 py-3 text-left font-medium">Availability</th>
              <th className="px-4 py-3 text-left font-medium">Latency</th>
              <th className="px-4 py-3 text-left font-medium">Packet loss</th>
              <th className="px-4 py-3 text-left font-medium">Journeys</th>
              <th className="px-4 py-3 text-left font-medium">Last check</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((sensor) => {
              const isSelected = sensor.id === selectedSensorId;
              return (
                <tr
                  key={sensor.id}
                  className={`cursor-pointer bg-surface/40 text-white transition hover:bg-white/5 ${isSelected ? 'ring-1 ring-accent/60' : ''}`}
                  onClick={() => onSelect(sensor.id)}
                >
                  <td className="px-4 py-3 font-medium">{sensor.name}</td>
                  <td className="px-4 py-3 text-white/70">{sensor.site}</td>
                  <td className="px-4 py-3 text-white/70">{sensor.region}</td>
                  <td className="px-4 py-3">{sensor.availability.toFixed(2)}%</td>
                  <td className="px-4 py-3">{sensor.latencyMs} ms</td>
                  <td className="px-4 py-3">{sensor.packetLoss.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-white/70">{sensor.journeysImpacted}</td>
                  <td className="px-4 py-3 text-white/60">{new Date(sensor.lastCheck).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sensor.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <span>{filtered.length} sensors shown</span>
        <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-white">
          Export CSV <ChevronDown className="h-4 w-4" />
        </button>
      </footer>
    </section>
  );
}
