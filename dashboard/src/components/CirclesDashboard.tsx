import { useMemo } from 'react';
import { Activity, ArrowUpRight, Globe2, ServerCog, Wifi } from 'lucide-react';
import type {
  DiagnosticTest,
  ExperienceSensorOverview,
  MetricPoint,
  ServiceTestOverview
} from '../types';
import { Sparkline } from './common/Sparkline';

export type CircleDetailDescriptor =
  | { kind: 'experience'; id: string }
  | { kind: 'service'; id: string }
  | { kind: 'internal'; id: string }
  | { kind: 'external'; id: string };

interface CirclesDashboardProps {
  experienceSensors: ExperienceSensorOverview[];
  serviceTests: ServiceTestOverview[];
  internalTests: DiagnosticTest[];
  externalTests: DiagnosticTest[];
  onOpenDetail: (detail: CircleDetailDescriptor) => void;
}

const statusTone: Record<string, string> = {
  good: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]',
  info: 'bg-sky-500/20 text-sky-100 border-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]',
  warning: 'bg-amber-500/20 text-amber-100 border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]',
  error: 'bg-rose-500/20 text-rose-100 border-rose-400/60 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]',
  offline: 'bg-slate-600/30 text-slate-100 border-slate-500/60 shadow-[0_0_0_1px_rgba(148,163,184,0.25)]'
};

function StatusSummary({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70">
      {label}
      <span className="text-white">{count}</span>
    </span>
  );
}

function buildTrend(points: MetricPoint[]): MetricPoint[] {
  return points.slice(-6);
}

function resolveTrend(
  item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest,
  kind: CircleDetailDescriptor['kind']
): MetricPoint[] {
  if (kind === 'experience') {
    return (item as ExperienceSensorOverview).performance.map((point) => ({
      timestamp: point.timestamp,
      value: point.availability
    }));
  }
  if (kind === 'service') {
    const series = (item as ServiceTestOverview).metrics[0];
    return series ? series.points : [];
  }
  const series = (item as DiagnosticTest).metrics[0];
  return series ? series.points : [];
}

function resolveItemLabel(item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest): string {
  if ('name' in item) {
    return item.name;
  }
  if ('target' in (item as DiagnosticTest)) {
    return (item as DiagnosticTest).target;
  }
  return 'Detail';
}

export function CirclesDashboard({
  experienceSensors,
  serviceTests,
  internalTests,
  externalTests,
  onOpenDetail
}: CirclesDashboardProps) {
  const categories = useMemo(
    () => [
      {
        id: 'experience' as const,
        label: 'Experience',
        description: 'Sensors reporting live Wi‑Fi telemetry and synthetic experience metrics.',
        icon: <Wifi className="h-5 w-5" />,
        items: experienceSensors
      },
      {
        id: 'service' as const,
        label: 'Services',
        description: 'Wi‑Fi, DHCP, Gateway and DNS synthetic tests running across sensors.',
        icon: <ServerCog className="h-5 w-5" />,
        items: serviceTests
      },
      {
        id: 'internal' as const,
        label: 'Internal tests',
        description: 'ICMP reachability checks to critical private services and IPs.',
        icon: <Activity className="h-5 w-5" />,
        items: internalTests
      },
      {
        id: 'external' as const,
        label: 'External tests',
        description: 'HTTP and ICMP probes to SaaS destinations such as Google and GitHub.',
        icon: <Globe2 className="h-5 w-5" />,
        items: externalTests
      }
    ],
    [experienceSensors, serviceTests, internalTests, externalTests]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-xl shadow-black/30">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-accent">Dashboard</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Experience circles</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Four primary workspaces summarise sensor health, service checks and diagnostic reachability. Select a card or circle to pivot into the detailed Cape Networks page with live metrics, charts and remediation actions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50">
          <StatusSummary label="Total sensors" count={experienceSensors.length} />
          <StatusSummary label="Service tests" count={serviceTests.length} />
          <StatusSummary label="Diagnostics" count={internalTests.length + externalTests.length} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {categories.map((category) => {
          const grouped = category.items.reduce<Record<string, number>>((acc, item) => {
            const status = (item as ExperienceSensorOverview).status ?? 'info';
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
          }, {});

          const trendSeries = category.items[0] ? resolveTrend(category.items[0], category.id === 'service' ? 'service' : category.id) : [];

          return (
            <div
              key={category.id}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-accent/50 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
                    {category.icon}
                    {category.label}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">{category.description}</p>
                </div>
                <button
                  onClick={() => {
                    const firstItem = category.items[0];
                    if (!firstItem) return;
                    const descriptor: CircleDetailDescriptor =
                      category.id === 'experience'
                        ? { kind: 'experience', id: firstItem.id }
                        : category.id === 'service'
                          ? { kind: 'service', id: firstItem.id }
                          : category.id === 'internal'
                            ? { kind: 'internal', id: firstItem.id }
                            : { kind: 'external', id: firstItem.id };
                    onOpenDetail(descriptor);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 transition hover:border-accent/50 hover:text-accent"
                >
                  Open page
                </button>
              </div>

              {trendSeries.length > 0 && (
                <div className="mt-4 h-24 w-full rounded-2xl border border-white/5 bg-[#0f223f]/80 p-2">
                  <Sparkline points={buildTrend(trendSeries)} color="#38bdf8" />
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-white/60">
                {Object.entries(grouped).map(([status, count]) => (
                  <span key={status} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {status}: <span className="text-white">{count}</span>
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4">
                {category.items.slice(0, 8).map((item) => {
                  const status = (item as ExperienceSensorOverview).status ?? 'info';
                  const tone = statusTone[status] ?? statusTone.info;
                  const descriptor: CircleDetailDescriptor =
                    category.id === 'experience'
                      ? { kind: 'experience', id: item.id }
                      : category.id === 'service'
                        ? { kind: 'service', id: item.id }
                        : category.id === 'internal'
                          ? { kind: 'internal', id: item.id }
                          : { kind: 'external', id: item.id };

                  const label = resolveItemLabel(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onOpenDetail(descriptor)}
                      className={`relative flex h-24 flex-col items-center justify-center rounded-full border text-center text-sm font-semibold transition hover:-translate-y-1 hover:shadow-[0_20px_45px_-20px_rgba(56,189,248,0.7)] ${tone}`}
                    >
                      <span className="px-2 leading-tight text-white">{label.slice(0, 18)}</span>
                      <span className="mt-1 text-[11px] uppercase tracking-widest text-white/60">View detail</span>
                    </button>
                  );
                })}
              </div>

              {category.items.length > 8 && (
                <button
                  onClick={() => {
                    const descriptor: CircleDetailDescriptor =
                      category.id === 'experience'
                        ? { kind: 'experience', id: category.items[0].id }
                        : category.id === 'service'
                          ? { kind: 'service', id: category.items[0].id }
                          : category.id === 'internal'
                            ? { kind: 'internal', id: category.items[0].id }
                            : { kind: 'external', id: category.items[0].id };
                    onOpenDetail(descriptor);
                  }}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:translate-x-1"
                >
                  Explore all {category.items.length} {category.label.toLowerCase()}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
