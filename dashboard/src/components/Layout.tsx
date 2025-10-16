import { ReactNode } from 'react';
import { Loader2, Menu, Network, Radar, RefreshCcw, Settings, Signal, SquareLibrary } from 'lucide-react';
import { formatDateTime } from '../utils/format';

interface LayoutProps {
  children: ReactNode;
  generatedAt?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  summary?: {
    sensorCount: number;
    impactedJourneys: number;
    criticalAlerts: number;
  };
}

export function Layout({ children, generatedAt, onRefresh, refreshing, summary }: LayoutProps) {
  return (
    <div className="flex h-full min-h-screen bg-background text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-white/5 bg-surface/80 p-6 lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Radar className="h-6 w-6 text-accent" />
          UXI Control Center
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1 text-sm">
          <a className="flex items-center gap-3 rounded-lg bg-accent/20 p-3 font-medium text-accent transition hover:bg-accent/30" href="#overview">
            <SquareLibrary className="h-4 w-4" /> Overview
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#journeys">
            <Signal className="h-4 w-4" /> Journeys
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#sensors">
            <Network className="h-4 w-4" /> Sensors
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#alerts">
            <RefreshCcw className="h-4 w-4" /> Incidents
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#settings">
            <Settings className="h-4 w-4" /> Settings
          </a>
        </nav>
        <div className="rounded-lg border border-white/5 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">Live Status</p>
          <p className="mt-2">Pipeline heartbeat healthy. Last ingest 24s ago.</p>
          {summary && (
            <dl className="mt-4 grid grid-cols-1 gap-2 text-white/60">
              <div className="flex items-center justify-between">
                <dt>Sensors onboarded</dt>
                <dd className="text-white">{summary.sensorCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Journeys impacted</dt>
                <dd className="text-white">{summary.impactedJourneys}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Critical alerts</dt>
                <dd className="text-white">{summary.criticalAlerts}</dd>
              </div>
            </dl>
          )}
        </div>
      </aside>
      <main className="flex-1">
        <header className="flex flex-col gap-4 border-b border-white/5 bg-surface/60 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm font-medium text-white/70">
            <button className="lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Multi-tenant Preview
            </span>
            <span>
              Last sync: {generatedAt ? formatDateTime(generatedAt) : 'Loading…'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh data
              </button>
            )}
            <div className="text-right">
              <p className="text-white">Alex Rivera</p>
              <p>Global Operations</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/30 font-semibold text-white">
              AR
            </div>
          </div>
        </header>
        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
