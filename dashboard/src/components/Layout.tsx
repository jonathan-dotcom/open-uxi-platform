import { ReactNode, useMemo, useState } from 'react';
import { Bell, Filter, Loader2, Menu, RefreshCcw, Search, Signal, SquareLibrary, X } from 'lucide-react';
import type { FilterOptions, FilterState, NotificationIssue, UpdateItem } from '../types';
import { formatDateTime } from '../utils/format';

interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

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
  navSections: NavigationSection[];
  activeNav: string;
  onNavigate: (id: string) => void;
  headerTitle: string;
  headerSubtitle?: string;
}

function OverlayButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:border-accent/60 hover:text-accent"
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
  counts,
  navSections,
  activeNav,
  onNavigate,
  headerTitle,
  headerSubtitle
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
    <div className="absolute right-8 top-[82px] z-50 w-[360px] rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-5 text-sm shadow-2xl backdrop-blur">
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
              <li key={update.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-accent">{update.category}</p>
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
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                      selectedStates.has(state)
                        ? 'bg-accent/30 text-accent'
                        : 'border border-white/10 text-white/60 hover:border-accent/40 hover:text-accent'
                    }`}
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
              <li key={notification.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                  <span className="text-accent">{notification.severity}</span>
                  <span>{formatDateTime(notification.detectedAt)}</span>
                </div>
                <p className="mt-1 font-semibold text-white">{notification.title}</p>
                <p className="mt-2 text-xs text-white/70">{notification.summary}</p>
                <div className="mt-3 text-[11px] text-white/50">
                  <p>Sensor: {notification.sensor}</p>
                  <p>Network: {notification.network}</p>
                  <p>Tasks: {notification.actions.join(', ')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#061425] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-white/5 bg-[#071933]/90 px-6 pb-8 pt-8 text-sm text-white/70 xl:flex">
          <div className="mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white/60">
              <Signal className="h-3 w-3 text-accent" />
              <span>Cape</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-accent">Network Intelligence</p>
              <h1 className="mt-1 text-xl font-semibold text-white">Dashboard</h1>
            </div>
          </div>
          <nav className="flex flex-col gap-6">
            {navSections.map((section) => (
              <div key={section.id}>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">{section.label}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {section.items.map((item) => {
                    const isActive = item.id === activeNav;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`group inline-flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                          isActive
                            ? 'border-accent/60 bg-accent/10 text-accent shadow-[0_0_0_1px_rgba(59,130,246,0.15)]'
                            : 'border-transparent hover:border-accent/40 hover:bg-white/5 hover:text-accent'
                        }`}
                      >
                        <span className={`grid h-9 w-9 place-items-center rounded-xl border bg-white/5 transition ${
                          isActive ? 'border-accent/60 text-accent' : 'border-white/10 text-white group-hover:border-accent/40 group-hover:text-accent'
                        }`}>
                          {item.icon}
                        </span>
                        <span className={`text-sm font-medium ${isActive ? 'text-accent' : 'text-white group-hover:text-accent'}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          {counts && (
            <div className="mt-10 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-xs uppercase tracking-widest text-white/60">
              <div className="flex items-center justify-between">
                <span>Sensors online</span>
                <span className="text-white">{counts.sensorsOnline}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Agents online</span>
                <span className="text-white">{counts.agentsOnline}</span>
              </div>
            </div>
          )}
          <p className="mt-auto text-[11px] text-white/40">Updated {generatedAt ? formatDateTime(generatedAt) : 'n/a'}</p>
        </aside>
        <div className="flex-1">
          <div className="relative flex flex-col">
            <header className="border-b border-white/5 bg-[#0a1b33]/90 px-6 pb-6 pt-6 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/50 xl:hidden">
                    <Signal className="h-3 w-3 text-accent" />
                    <span>Cape dashboard</span>
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{headerTitle}</h2>
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    {headerSubtitle ?? `Generated ${generatedAt ? formatDateTime(generatedAt) : 'n/a'}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative hidden sm:block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      type="search"
                      placeholder="Search sensors, tests or networks"
                      className="w-72 rounded-full border border-white/10 bg-white/10 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:border-accent/60 focus:outline-none"
                    />
                  </div>
                  <OverlayButton icon={<SquareLibrary className="h-4 w-4" />} label="Product updates" onClick={() => toggleOverlay('updates')} />
                  <OverlayButton icon={<Filter className="h-4 w-4" />} label="Filter sensors" onClick={() => toggleOverlay('filter')} />
                  <OverlayButton icon={<Bell className="h-4 w-4" />} label="Notifications" onClick={() => toggleOverlay('notifications')} />
                  <button
                    onClick={onRefresh}
                    className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent transition hover:bg-accent/20"
                  >
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white xl:hidden">
                    <Menu className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 sm:hidden">
                {navSections.flatMap((section) => section.items).map((item) => {
                  const isActive = item.id === activeNav;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${
                        isActive ? 'border-accent/60 bg-accent/10 text-accent' : 'border-white/10 text-white/70'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {summary && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/60">Sensors</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{summary.sensorCount}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/60">Impacted journeys</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{summary.impactedJourneys}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/60">Critical alerts</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{summary.criticalAlerts}</p>
                  </div>
                </div>
              )}
            </header>
            <main className="flex-1 space-y-10 px-6 pb-16 pt-10">{children}</main>
            {activeOverlay && (
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setActiveOverlay(null)} />
            )}
            {activeOverlay && overlayContent}
          </div>
        </div>
      </div>
    </div>
  );
}
