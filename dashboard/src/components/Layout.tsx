import { ReactNode, useMemo, useState } from 'react';
import {
  Bell,
  Filter,
  Grid,
  Loader2,
  Menu,
  Network,
  Radar,
  RefreshCcw,
  Settings,
  Signal,
  SquareLibrary,
  X
} from 'lucide-react';
import type { FilterOptions, FilterState, NotificationIssue, UpdateItem } from '../types';
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
  updates: UpdateItem[];
  notifications: NotificationIssue[];
  filterOptions: FilterOptions;
  filterState: FilterState;
  onFilterChange: (next: FilterState) => void;
  counts?: {
    sensorsOnline: number;
    agentsOnline: number;
  };
}

function OverlayButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
    >
      {icon}
    </button>
  );
}

export function Layout({
  children,
  generatedAt,
  onRefresh,
  refreshing,
  summary,
  updates,
  notifications,
  filterOptions,
  filterState,
  onFilterChange,
  counts
}: LayoutProps) {
  const [activeOverlay, setActiveOverlay] = useState<'updates' | 'filter' | 'notifications' | null>(null);

  const toggleOverlay = (overlay: 'updates' | 'filter' | 'notifications') => {
    setActiveOverlay((current) => (current === overlay ? null : overlay));
  };

  const selectedStates = useMemo(
    () => new Set<FilterState['states'][number]>(filterState.states),
    [filterState.states]
  );

  const handleStateToggle = (state: FilterState['states'][number]) => {
    const next = new Set(selectedStates);
    if (next.has(state)) {
      next.delete(state);
    } else {
      next.add(state);
    }
    if (next.size === 0) {
      return;
    }
    onFilterChange({
      ...filterState,
      states: Array.from(next) as FilterState['states']
    });
  };

  const setSelectValue = (key: 'group' | 'wirelessNetwork' | 'wiredNetwork', value: string | null) => {
    onFilterChange({
      ...filterState,
      [key]: value
    });
  };

  const overlayContent = (
    <div className="absolute right-6 top-20 z-50 w-[320px] rounded-2xl border border-white/10 bg-surface/95 p-4 text-sm shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">
          {activeOverlay === 'updates' && 'Product updates'}
          {activeOverlay === 'filter' && 'Filter sensors'}
          {activeOverlay === 'notifications' && 'Notifications'}
        </div>
        <button onClick={() => setActiveOverlay(null)} aria-label="Close panel">
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
      <div className="mt-4 space-y-4 text-white/80">
        {activeOverlay === 'updates' && (
          <ul className="space-y-3">
            {updates.map((update) => (
              <li key={update.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-accent">{update.category}</p>
                <p className="mt-1 font-semibold text-white">{update.title}</p>
                <p className="mt-2 text-xs text-white/70">{update.body}</p>
                <p className="mt-2 text-right text-[10px] uppercase tracking-wide text-white/50">{update.date}</p>
              </li>
            ))}
          </ul>
        )}
        {activeOverlay === 'filter' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">State</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {filterOptions.states.map((state) => (
                  <button
                    key={state}
                    onClick={() => handleStateToggle(state)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${selectedStates.has(state) ? 'bg-accent/30 text-accent' : 'border border-white/10 text-white/60 hover:border-accent/40 hover:text-accent'}`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Group
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={filterState.group ?? ''}
                  onChange={(event) => setSelectValue('group', event.target.value || null)}
                >
                  <option value="">All groups</option>
                  {filterOptions.groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Wireless network
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={filterState.wirelessNetwork ?? ''}
                  onChange={(event) => setSelectValue('wirelessNetwork', event.target.value || null)}
                >
                  <option value="">All wireless</option>
                  {filterOptions.wirelessNetworks.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Wired network
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={filterState.wiredNetwork ?? ''}
                  onChange={(event) => setSelectValue('wiredNetwork', event.target.value || null)}
                >
                  <option value="">All wired</option>
                  {filterOptions.wiredNetworks.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
        {activeOverlay === 'notifications' && (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                  <span className="text-accent">{notification.severity}</span>
                  <span>{formatDateTime(notification.detectedAt)}</span>
                </div>
                <p className="mt-1 font-semibold text-white">{notification.title}</p>
                <p className="mt-2 text-xs text-white/70">{notification.summary}</p>
                <div className="mt-3 text-[11px] text-white/50">
                  <p>Sensor: {notification.sensor}</p>
                  <p>Network: {notification.network}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {notification.actions.map((action) => (
                    <span
                      key={action.id}
                      className="rounded-full border border-accent/40 px-3 py-1 text-[10px] uppercase tracking-wide text-accent"
                    >
                      {action.label}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-screen bg-background text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-white/5 bg-surface/80 p-6 lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Radar className="h-6 w-6 text-accent" />
          UXI Control Center
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1 text-sm">
          <a className="flex items-center gap-3 rounded-lg bg-accent/20 p-3 font-medium text-accent transition hover:bg-accent/30" href="#circles">
            <SquareLibrary className="h-4 w-4" /> Circles
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#tile-view">
            <Signal className="h-4 w-4" /> Tile view
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#path-analysis">
            <Network className="h-4 w-4" /> Path analysis
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#settings">
            <Settings className="h-4 w-4" /> Settings
          </a>
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#alerts">
            <RefreshCcw className="h-4 w-4" /> Alerts
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
          {counts && (
            <dl className="mt-4 grid grid-cols-1 gap-2 text-white/60">
              <div className="flex items-center justify-between">
                <dt>Sensors online</dt>
                <dd className="text-white">{counts.sensorsOnline}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Agents online</dt>
                <dd className="text-white">{counts.agentsOnline}</dd>
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
            <div className="flex items-center gap-2">
              <OverlayButton icon={<Grid className="h-4 w-4" />} label="Updates" onClick={() => toggleOverlay('updates')} />
              <OverlayButton icon={<Filter className="h-4 w-4" />} label="Filter" onClick={() => toggleOverlay('filter')} />
              <OverlayButton icon={<Bell className="h-4 w-4" />} label="Notifications" onClick={() => toggleOverlay('notifications')} />
            </div>
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
        <div className="relative">
          {activeOverlay && overlayContent}
          <div className="p-6 lg:p-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
