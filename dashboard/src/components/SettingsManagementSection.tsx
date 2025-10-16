import { MapPin, PenSquare, Power, ShieldCheck, Wifi } from 'lucide-react';
import type {
  AgentInventoryEntry,
  GroupManagementEntry,
  NetworkEntry,
  SensorInventoryEntry,
  ServiceInventoryEntry
} from '../types';
import { Sparkline } from './common/Sparkline';

interface SettingsManagementSectionProps {
  groups: GroupManagementEntry[];
  sensors: SensorInventoryEntry[];
  agents: AgentInventoryEntry[];
  networks: {
    wireless: NetworkEntry[];
    wired: NetworkEntry[];
  };
  services: ServiceInventoryEntry[];
}

const statusTone: Record<string, string> = {
  good: 'text-emerald-300',
  info: 'text-sky-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
  offline: 'text-slate-300'
};

export function SettingsManagementSection({ groups, sensors, agents, networks, services }: SettingsManagementSectionProps) {
  return (
    <section id="management" className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Settings</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Management overview</h2>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          Manage groups, sensors, agents, networks and service tests from a single surface. Launch diagnostics, edit assignments or reboot hardware directly from these tables.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Groups</h3>
              <p className="text-xs text-white/60">Map and list views for all sensor groups.</p>
            </div>
            <MapPin className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-4 space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                  <span>{group.location}</span>
                  <span className={statusTone[group.status] ?? 'text-white/60'}>{group.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{group.name}</p>
                    <p className="text-xs text-white/60">
                      {group.sensors} sensors • {group.agents} agents • {group.networks} networks • {group.services} services
                    </p>
                  </div>
                  <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Sensors</h3>
              <p className="text-xs text-white/60">Master list with quick actions.</p>
            </div>
            <Wifi className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-4 space-y-3">
            {sensors.map((sensor) => (
              <div key={sensor.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                  <span>{sensor.serial}</span>
                  <span className={statusTone[sensor.status] ?? 'text-white/60'}>{sensor.status}</span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-base font-semibold text-white">{sensor.name}</p>
                    <p className="text-xs text-white/60">{sensor.model} • {sensor.assignedGroup}</p>
                    <p className="text-[11px] text-white/50">{sensor.online ? 'Online' : 'Offline'} • DPP {sensor.dppCapable ? 'enabled' : 'not available'}</p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                      Info
                    </button>
                    <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                      Edit
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-200 hover:bg-rose-500/10">
                      <Power className="h-3 w-3" /> Reboot
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Agents</h3>
              <p className="text-xs text-white/60">Mobile agents with assignment and status.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-4 space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                  <span>{agent.type}</span>
                  <span className={statusTone[agent.status] ?? 'text-white/60'}>{agent.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{agent.name}</p>
                    <p className="text-xs text-white/60">{agent.model} • {agent.assignedGroup}</p>
                    <p className="text-[11px] text-white/50">{agent.online ? 'Online' : 'Offline'}</p>
                  </div>
                  <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold text-white">Networks</h3>
          <p className="text-xs text-white/60">Wireless and wired definitions with connectivity metadata.</p>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-xs uppercase tracking-wide text-white/60">Wireless</h4>
              <div className="mt-2 space-y-3">
                {networks.wireless.map((network) => (
                  <div key={network.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                      <span>{network.security}</span>
                      <span>{network.ipStack}</span>
                    </div>
                    <p className="mt-1 text-base font-semibold text-white">{network.name}</p>
                    <p className="text-xs text-white/60">{network.sensors} sensors • {network.externalConnectivity ?? 'External connectivity enabled'}</p>
                    <p className="text-[11px] text-white/50">Band lock: {network.bandLock ?? 'Auto'} • Updated {network.modifiedAt}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wide text-white/60">Wired</h4>
              <div className="mt-2 space-y-3">
                {networks.wired.map((network) => (
                  <div key={network.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                      <span>{network.security}</span>
                      <span>{network.ipStack}</span>
                    </div>
                    <p className="mt-1 text-base font-semibold text-white">{network.name}</p>
                    <p className="text-xs text-white/60">{network.sensors} sensors • {network.assigned ? 'Assigned' : 'Unassigned'}</p>
                    <p className="text-[11px] text-white/50">Updated {network.modifiedAt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Services</h3>
            <p className="text-xs text-white/60">Internal and external test configuration with live charts.</p>
          </div>
          <PenSquare className="h-5 w-5 text-accent" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                <span>{service.category}</span>
                <span>{service.testType}</span>
              </div>
              <p className="mt-1 text-base font-semibold text-white">{service.name}</p>
              <p className="text-xs text-white/60">{service.target}</p>
              {service.metrics[0] && <Sparkline points={service.metrics[0].points} color="#f472b6" />}
              <div className="mt-3 flex items-center gap-2">
                <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                  View status
                </button>
                <button className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70 hover:border-accent/40 hover:text-accent">
                  Assign sensors
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
