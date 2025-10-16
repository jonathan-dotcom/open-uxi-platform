import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, Search } from 'lucide-react';
import { sensors, Sensor } from '../data/sampleData';
import { StatusBadge } from './StatusBadge';

const sorters: Record<string, (a: Sensor, b: Sensor) => number> = {
  site: (a, b) => a.site.localeCompare(b.site),
  availability: (a, b) => b.availability - a.availability,
  latency: (a, b) => a.latencyMs - b.latencyMs
};

export function SensorTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof typeof sorters>('availability');

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sensors
      .filter((sensor) => sensor.name.toLowerCase().includes(term) || sensor.site.toLowerCase().includes(term))
      .sort(sorters[sortKey]);
  }, [searchTerm, sortKey]);

  return (
    <section id="sensors" className="mt-12 rounded-2xl border border-white/5 bg-surface/80 p-6 shadow-card">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Sensor fleet</h2>
          <p className="text-sm text-white/60">Heartbeat, availability, and latency across your estate.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <Search className="h-4 w-4 text-white/40" />
            <input
              className="bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              placeholder="Search sensors"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <button
            onClick={() => setSortKey(sortKey === 'availability' ? 'latency' : sortKey === 'latency' ? 'site' : 'availability')}
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
              <th className="px-4 py-3 text-left font-medium">Availability</th>
              <th className="px-4 py-3 text-left font-medium">Latency</th>
              <th className="px-4 py-3 text-left font-medium">Last check</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((sensor) => (
              <tr key={sensor.id} className="bg-surface/40 text-white">
                <td className="px-4 py-3 font-medium">{sensor.name}</td>
                <td className="px-4 py-3 text-white/70">{sensor.site}</td>
                <td className="px-4 py-3">{sensor.availability.toFixed(2)}%</td>
                <td className="px-4 py-3">{sensor.latencyMs} ms</td>
                <td className="px-4 py-3 text-white/60">{new Date(sensor.lastCheck).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={sensor.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="mt-4 flex items-center justify-between text-xs text-white/50">
        <span>{filtered.length} sensors shown</span>
        <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-white">
          Export CSV <ChevronDown className="h-4 w-4" />
        </button>
      </footer>
    </section>
  );
}
