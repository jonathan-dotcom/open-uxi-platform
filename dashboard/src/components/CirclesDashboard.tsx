import { useMemo } from 'react';
import { Activity, Globe2, ServerCog, Wifi } from 'lucide-react';
import type {
  DiagnosticTest,
  ExperienceSensorOverview,
  MetricPoint,
  ServiceEvent,
  ServiceTestOverview
} from '../types';
import { formatDateTime } from '../utils/format';
import { Sparkline } from './common/Sparkline';
import type { ReactNode } from 'react';

interface CirclesDashboardProps {
  experienceSensors: ExperienceSensorOverview[];
  serviceTests: ServiceTestOverview[];
  internalTests: DiagnosticTest[];
  externalTests: DiagnosticTest[];
  selectedCategory: 'experience' | 'services' | 'internal' | 'external';
  onSelectCategory: (category: 'experience' | 'services' | 'internal' | 'external') => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  timeRanges: string[];
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
}

const statusColor: Record<string, string> = {
  good: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
  info: 'border-sky-400/40 bg-sky-500/20 text-sky-200',
  warning: 'border-amber-400/50 bg-amber-400/20 text-amber-100',
  error: 'border-rose-500/40 bg-rose-500/20 text-rose-200',
  offline: 'border-slate-500/40 bg-slate-600/20 text-slate-200'
};

const categoryConfig: {
  id: CirclesDashboardProps['selectedCategory'];
  label: string;
  description: string;
  icon: JSX.Element;
}[] = [
  { id: 'experience', label: 'Experience', description: 'Sensors and live Wi‑Fi metrics', icon: <Wifi className="h-4 w-4" /> },
  { id: 'services', label: 'Services', description: 'DHCP, DNS, Gateway tests', icon: <ServerCog className="h-4 w-4" /> },
  { id: 'internal', label: 'Internal tests', description: 'Internal connectivity & ICMP', icon: <Activity className="h-4 w-4" /> },
  { id: 'external', label: 'External tests', description: 'SaaS performance probes', icon: <Globe2 className="h-4 w-4" /> }
];

function circleKey(category: CirclesDashboardProps['selectedCategory'], item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest) {
  return `${category}-${item.id}`;
}

function resolveStatus(item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest): string {
  if ('status' in item) {
    return item.status;
  }
  return 'info';
}

function resolveTitle(item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest): string {
  if ('name' in item) {
    return item.name;
  }
  return 'Detail';
}

function resolveSubtitle(
  category: CirclesDashboardProps['selectedCategory'],
  item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest
): string {
  if (category === 'experience') {
    const sensor = item as ExperienceSensorOverview;
    return sensor.location;
  }
  if (category === 'services') {
    const test = item as ServiceTestOverview;
    return `${test.category} service`;
  }
  const diagnostic = item as DiagnosticTest;
  return diagnostic.target;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">{title}</h4>
      <div className="text-sm text-white/80">{children}</div>
    </section>
  );
}

function renderEvents(events: ServiceEvent[]) {
  if (events.length === 0) {
    return <p className="text-xs text-white/60">No active events.</p>;
  }
  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
            <span className="text-accent">{event.severity}</span>
            <span>{formatDateTime(event.detectedAt)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white">{event.title}</p>
          <p className="mt-2 leading-relaxed">{event.rootCause}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {event.actions.map((action) => (
              <span key={action.id} className="rounded-full border border-accent/30 px-3 py-1 text-[10px] uppercase tracking-wide text-accent">
                {action.label}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CirclesDashboard({
  experienceSensors,
  serviceTests,
  internalTests,
  externalTests,
  selectedCategory,
  onSelectCategory,
  selectedItemId,
  onSelectItem,
  timeRanges,
  selectedTimeRange,
  onTimeRangeChange
}: CirclesDashboardProps) {
  const items = useMemo(() => {
    switch (selectedCategory) {
      case 'experience':
        return experienceSensors;
      case 'services':
        return serviceTests;
      case 'internal':
        return internalTests;
      case 'external':
        return externalTests;
      default:
        return [];
    }
  }, [selectedCategory, experienceSensors, serviceTests, internalTests, externalTests]);

  const activeItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? items[0], [items, selectedItemId]);

  const availabilitySeries: MetricPoint[] = useMemo(() => {
    if (!activeItem || selectedCategory !== 'experience') {
      return [];
    }
    const sensor = activeItem as ExperienceSensorOverview;
    return sensor.performance.map((point) => ({ timestamp: point.timestamp, value: point.availability }));
  }, [activeItem, selectedCategory]);

  const latencySeries: MetricPoint[] = useMemo(() => {
    if (!activeItem) {
      return [];
    }
    if (selectedCategory === 'experience') {
      const sensor = activeItem as ExperienceSensorOverview;
      return sensor.performance.map((point) => ({ timestamp: point.timestamp, value: point.latencyMs }));
    }
    if (selectedCategory === 'services') {
      const series = (activeItem as ServiceTestOverview).metrics[0];
      return series ? series.points : [];
    }
    if (selectedCategory === 'internal' || selectedCategory === 'external') {
      const series = (activeItem as DiagnosticTest).metrics[0];
      return series ? series.points : [];
    }
    return [];
  }, [activeItem, selectedCategory]);

  return (
    <div id="circles" className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-lg shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Dashboard</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Experience-centric Circles</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Four categories summarising the health of sensors, core services and synthetic tests. Select a circle to reveal detailed telemetry, charts and remediation actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Time range</span>
          <select
            value={selectedTimeRange}
            onChange={(event) => onTimeRangeChange(event.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            {timeRanges.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {categoryConfig.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${
              selectedCategory === category.id ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between text-sm text-white">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/10 text-accent">
                  {category.icon}
                </span>
                {category.label}
              </span>
              <span className="text-xs uppercase tracking-widest text-white/50">{items.length} items</span>
            </div>
            <p className="text-xs text-white/60">{category.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const status = resolveStatus(item);
              const isSelected = activeItem?.id === item.id;
              return (
                <button
                  key={circleKey(selectedCategory, item)}
                  onClick={() => onSelectItem(item.id)}
                  className={`flex h-32 flex-col items-center justify-center rounded-3xl border-2 transition ${
                    isSelected ? 'border-accent bg-accent/10' : statusColor[status] ?? 'border-white/10 bg-white/5 text-white/70'
                  }`}
                >
                  <div className="text-center text-sm font-semibold">
                    <p>{resolveTitle(item)}</p>
                    <p className="text-xs text-white/70">{resolveSubtitle(selectedCategory, item)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
          {activeItem ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-accent">Selected</p>
                  <h3 className="text-xl font-semibold text-white">{resolveTitle(activeItem)}</h3>
                  <p className="text-xs text-white/60">{resolveSubtitle(selectedCategory, activeItem)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${statusColor[resolveStatus(activeItem)] ?? 'border border-white/10 bg-white/10 text-white/70'}`}>
                  {resolveStatus(activeItem)}
                </span>
              </div>

              {selectedCategory === 'experience' && (
                <div className="space-y-4">
                  {availabilitySeries.length > 0 && (
                    <DetailSection title="Availability trend">
                      <Sparkline points={availabilitySeries} color="#34d399" />
                    </DetailSection>
                  )}
                  {latencySeries.length > 0 && (
                    <DetailSection title="Latency trend">
                      <Sparkline points={latencySeries} color="#38bdf8" />
                    </DetailSection>
                  )}
                  <DetailSection title="Live Wi‑Fi metrics">
                    <ul className="grid grid-cols-2 gap-3 text-xs text-white/80">
                      {(activeItem as ExperienceSensorOverview).metrics.map((metric) => (
                        <li key={metric.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-wide text-white/50">{metric.label}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
                          {metric.helper && <p className="text-[11px] text-white/60">{metric.helper}</p>}
                        </li>
                      ))}
                    </ul>
                  </DetailSection>
                  <DetailSection title="Actions">
                    <div className="flex flex-wrap gap-2">
                      {(activeItem as ExperienceSensorOverview).actions.map((action) => (
                        <button
                          key={action.id}
                          className="rounded-full border border-accent/40 px-3 py-1 text-[10px] uppercase tracking-wide text-accent transition hover:bg-accent/10"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </DetailSection>
                </div>
              )}

              {selectedCategory === 'services' && (
                <div className="space-y-4">
                  {(activeItem as ServiceTestOverview).metrics.map((series) => (
                    <DetailSection key={series.id} title={`${series.label} (${series.unit})`}>
                      <Sparkline points={series.points} color="#fbbf24" />
                    </DetailSection>
                  ))}
                  <DetailSection title="Events">
                    {renderEvents((activeItem as ServiceTestOverview).ongoingEvents)}
                  </DetailSection>
                </div>
              )}

              {(selectedCategory === 'internal' || selectedCategory === 'external') && (
                <div className="space-y-4">
                  {(activeItem as DiagnosticTest).metrics.map((series) => (
                    <DetailSection key={series.id} title={`${series.label} (${series.unit})`}>
                      <Sparkline points={series.points} color={selectedCategory === 'internal' ? '#a855f7' : '#fb7185'} />
                    </DetailSection>
                  ))}
                  <DetailSection title="About">
                    <p className="text-sm leading-relaxed text-white/80">{(activeItem as DiagnosticTest).about}</p>
                    <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                      <li><span className="font-semibold text-white">Latency:</span> {(activeItem as DiagnosticTest).latencyMs} ms</li>
                      <li><span className="font-semibold text-white">Packet loss:</span> {(activeItem as DiagnosticTest).packetLoss}%</li>
                      <li><span className="font-semibold text-white">Jitter:</span> {(activeItem as DiagnosticTest).jitterMs} ms</li>
                      <li><span className="font-semibold text-white">Frequency:</span> {(activeItem as DiagnosticTest).frequency}</li>
                    </ul>
                  </DetailSection>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white/60">Select a circle to explore detailed telemetry.</p>
          )}
        </div>
      </div>
    </div>
  );
}
