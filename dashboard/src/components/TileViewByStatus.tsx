import type { TileSensor } from '../types';

interface TileViewByStatusProps {
  sensors: TileSensor[];
  onSelect: (sensorId: string) => void;
}

const statusOrder: { key: TileSensor['status']; label: string; description: string }[] = [
  { key: 'good', label: 'Good', description: 'Healthy sensors reporting in policy thresholds.' },
  { key: 'info', label: 'Info', description: 'Informational updates or maintenance windows.' },
  { key: 'warning', label: 'Warning', description: 'Sensor outside policy thresholds but still reachable.' },
  { key: 'error', label: 'Error', description: 'Sensor experiencing errors requiring intervention.' },
  { key: 'offline', label: 'Offline', description: 'No heartbeat from these sensors.' }
];

const badgeColors: Record<TileSensor['status'], string> = {
  good: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  info: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  warning: 'bg-amber-500/20 text-amber-100 border-amber-500/40',
  error: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  offline: 'bg-slate-600/30 text-slate-200 border-slate-500/40'
};

export function TileViewByStatus({ sensors, onSelect }: TileViewByStatusProps) {
  return (
    <section id="tile-view" className="mt-10 rounded-3xl border border-white/10 bg-surface/80 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Tile view</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Sensors grouped by status</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Quickly identify outliers and pivot directly into the sensor experience. Click any tile to open the full sensor detail page.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        {statusOrder.map((group) => {
          const entries = sensors.filter((sensor) => sensor.status === group.key);
          if (entries.length === 0) {
            return null;
          }
          return (
            <div key={group.key} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{group.label}</h3>
                  <p className="text-xs text-white/60">{group.description}</p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${badgeColors[group.key]}`}>
                  {entries.length} sensors
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {entries.map((sensor) => (
                  <button
                    key={sensor.id}
                    onClick={() => onSelect(sensor.id)}
                    className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-surface/60 p-4 text-left transition hover:border-accent/50 hover:bg-surface/90"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                      <span>{sensor.status}</span>
                      <span className="text-white/50">{sensor.group}</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{sensor.name}</p>
                      <p className="text-xs text-white/60">{sensor.network}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide text-accent opacity-0 transition group-hover:opacity-100">
                      View sensor detail →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
