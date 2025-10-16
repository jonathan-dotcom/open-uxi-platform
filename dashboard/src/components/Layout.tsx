import { ReactNode } from 'react';
import { Menu, Network, Radar, Settings, Signal, SquareLibrary } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
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
          <a className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/5" href="#settings">
            <Settings className="h-4 w-4" /> Settings
          </a>
        </nav>
        <div className="rounded-lg border border-white/5 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">Live Status</p>
          <p className="mt-2">Pipeline heartbeat healthy. Last ingest 24s ago.</p>
        </div>
      </aside>
      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-white/5 bg-surface/60 p-4 backdrop-blur">
          <div className="flex items-center gap-3 text-sm font-medium text-white/70">
            <button className="lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Multi-tenant Preview
            </span>
            <span>Last sync: 09:34:12 UTC</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <div className="text-right">
              <p className="text-white">Alex Rivera</p>
              <p>Global Operations</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/30 font-semibold text-white">
              AR
            </div>
          </div>
        </header>
        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
