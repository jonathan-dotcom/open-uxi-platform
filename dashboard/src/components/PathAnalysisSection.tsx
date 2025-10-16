import { useMemo, useState } from 'react';
import { ArrowRight, GitBranch, Route } from 'lucide-react';
import type { PathAnalysisData, PathHop, PathRoute } from '../types';
import { formatDateTime } from '../utils/format';

interface PathAnalysisSectionProps {
  data: PathAnalysisData;
}

const hopColor: Record<string, string> = {
  good: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-100',
  error: 'border-rose-500/50 bg-rose-500/10 text-rose-100',
  offline: 'border-slate-500/50 bg-slate-600/10 text-slate-100'
};

export function PathAnalysisSection({ data }: PathAnalysisSectionProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(data.routes[0]?.id ?? null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All groups');
  const [selectedSensor, setSelectedSensor] = useState<string>('All sensors');
  const [selectedDestination, setSelectedDestination] = useState<string>('All destinations');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(data.filters.timeRanges[0] ?? 'Last hour');
  const [activeTab, setActiveTab] = useState<'sort' | 'grouping'>('sort');
  const [hopRange, setHopRange] = useState<number>(4);
  const [timelineIndex, setTimelineIndex] = useState<number>(0);

  const filteredRoutes = useMemo(() => {
    return data.routes.filter((route) => {
      if (selectedGroup !== 'All groups' && route.sourceGroup !== selectedGroup) {
        return false;
      }
      if (selectedSensor !== 'All sensors' && route.sensor !== selectedSensor) {
        return false;
      }
      if (selectedDestination !== 'All destinations' && route.destination !== selectedDestination) {
        return false;
      }
      return route.hops.length <= hopRange || hopRange === 8;
    });
  }, [data.routes, hopRange, selectedDestination, selectedGroup, selectedSensor]);

  const timelineRoute = filteredRoutes[timelineIndex] ?? filteredRoutes[0] ?? null;

  const selectedRoute = useMemo<PathRoute | null>(() => {
    if (!selectedRouteId) {
      return filteredRoutes[0] ?? null;
    }
    return filteredRoutes.find((route) => route.id === selectedRouteId) ?? filteredRoutes[0] ?? null;
  }, [filteredRoutes, selectedRouteId]);

  const renderHop = (hop: PathHop) => {
    const tone = hopColor[hop.status] ?? hopColor.info;
    return (
      <div key={hop.id} className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
        <p className="text-xs uppercase tracking-wide text-white/60">{hop.type}</p>
        <p className="text-sm font-semibold text-white">{hop.label}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wide text-white/60">
          <div>
            <dt>RTT</dt>
            <dd className="text-white">{hop.rttMs} ms</dd>
          </div>
          <div>
            <dt>Jitter</dt>
            <dd className="text-white">{hop.jitterMs} ms</dd>
          </div>
          <div>
            <dt>Loss</dt>
            <dd className="text-white">{hop.packetLoss}%</dd>
          </div>
        </dl>
      </div>
    );
  };

  return (
    <section id="path-analysis" className="mt-10 rounded-3xl border border-white/10 bg-surface/80 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Path analysis</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Interactive network paths</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Filter by groups, sensors, destinations and adjust hop, RTT, jitter and packet loss tolerances. Use the timeline slider to replay historical network journeys.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('sort')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${activeTab === 'sort' ? 'bg-accent/30 text-accent' : 'border border-white/10 text-white/60 hover:text-accent'}`}
          >
            Sort & filter
          </button>
          <button
            onClick={() => setActiveTab('grouping')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${activeTab === 'grouping' ? 'bg-accent/30 text-accent' : 'border border-white/10 text-white/60 hover:text-accent'}`}
          >
            Grouping
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Group
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
              >
                <option>All groups</option>
                {data.filters.groups.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Sensor / Agent
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={selectedSensor}
                onChange={(event) => setSelectedSensor(event.target.value)}
              >
                <option>All sensors</option>
                {data.filters.sensors.map((sensor) => (
                  <option key={sensor}>{sensor}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Destination
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={selectedDestination}
                onChange={(event) => setSelectedDestination(event.target.value)}
              >
                <option>All destinations</option>
                {data.filters.destinations.map((destination) => (
                  <option key={destination}>{destination}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Time range
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={selectedTimeRange}
                onChange={(event) => setSelectedTimeRange(event.target.value)}
              >
                {data.filters.timeRanges.map((range) => (
                  <option key={range}>{range}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/60">
              Hop range
              <span className="text-white">≤ {hopRange} hops</span>
            </label>
            <input
              type="range"
              min={2}
              max={8}
              value={hopRange}
              onChange={(event) => setHopRange(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </div>
          {activeTab === 'grouping' && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Grouping options</p>
              <ul className="mt-2 space-y-2">
                <li className="rounded-xl border border-white/10 bg-surface/60 p-3">
                  <p className="font-semibold text-white">Source group</p>
                  <p>Cluster paths by sensor group to isolate regional issues.</p>
                </li>
                <li className="rounded-xl border border-white/10 bg-surface/60 p-3">
                  <p className="font-semibold text-white">Intermediate IP / domain</p>
                  <p>Identify congested provider edges and Internet exchanges.</p>
                </li>
                <li className="rounded-xl border border-white/10 bg-surface/60 p-3">
                  <p className="font-semibold text-white">Destination service</p>
                  <p>Compare SaaS performance across all contributing routes.</p>
                </li>
              </ul>
            </div>
          )}
        </div>
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
              <span>Timeline</span>
              {timelineRoute && <span>{formatDateTime(timelineRoute.capturedAt)}</span>}
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(filteredRoutes.length - 1, 0)}
              value={timelineIndex}
              onChange={(event) => setTimelineIndex(Number(event.target.value))}
              className="mt-3 w-full"
            />
            {timelineRoute ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                <p className="text-xs uppercase tracking-wide text-white/50">Replay</p>
                <p className="mt-1 text-sm">
                  {timelineRoute.sensor} → {timelineRoute.destination} via {timelineRoute.hops.length} hops
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/60">No routes matched your filters.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Routes</p>
                <h3 className="text-lg font-semibold text-white">{filteredRoutes.length} path snapshots</h3>
              </div>
              <Route className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-4 space-y-3">
              {filteredRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    selectedRoute?.id === route.id ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-surface/60 text-white/70 hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                    <span>{route.sourceGroup}</span>
                    <span>{formatDateTime(route.capturedAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <span>{route.sensor}</span>
                    <ArrowRight className="h-4 w-4 text-accent" />
                    <span>{route.destination}</span>
                  </div>
                  <p className="text-xs text-white/60">{route.hops.length} hops</p>
                </button>
              ))}
              {filteredRoutes.length === 0 && <p className="text-sm text-white/60">Adjust filters to view path history.</p>}
            </div>
          </div>
        </div>
      </div>

      {selectedRoute && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-surface/70 p-6">
          <div className="flex items-center gap-3 text-white">
            <GitBranch className="h-5 w-5 text-accent" />
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Selected path</p>
              <h3 className="text-lg font-semibold text-white">
                {selectedRoute.sensor} → {selectedRoute.destination} ({selectedRoute.hops.length} hops)
              </h3>
              <p className="text-xs text-white/50">Captured {formatDateTime(selectedRoute.capturedAt)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {selectedRoute.hops.map((hop) => renderHop(hop))}
          </div>
        </div>
      )}
    </section>
  );
}
