import { useMemo, useState } from 'react';
import { FileEdit, Info, MapPin, Power, Wifi } from 'lucide-react';
import type {
  AgentInventoryEntry,
  DiagnosticTest,
  GroupManagementEntry,
  NetworkEntry,
  SensorInventoryEntry,
  ServiceInventoryEntry
} from '../../types';

interface GroupsManagementPageProps {
  groups: GroupManagementEntry[];
  sensors: SensorInventoryEntry[];
  agents: AgentInventoryEntry[];
  networks: { wireless: NetworkEntry[]; wired: NetworkEntry[] };
  services: ServiceInventoryEntry[];
  onInspectSensor: (sensorName: string) => void;
}

const statusTone: Record<string, string> = {
  good: 'text-emerald-300',
  info: 'text-sky-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
  offline: 'text-slate-300'
};

export function GroupsManagementPage({ groups, sensors, agents, networks, services, onInspectSensor }: GroupsManagementPageProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'sensors' | 'agents' | 'networks' | 'services'>('sensors');
  const [selectedSensor, setSelectedSensor] = useState<SensorInventoryEntry | null>(null);

  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) ?? groups[0], [groups, selectedGroupId]);

  const filteredSensors = sensors.filter((sensor) => sensor.assignedGroup === selectedGroup?.name);
  const filteredAgents = agents.filter((agent) => agent.assignedGroup === selectedGroup?.name);

  return (
    <section className="relative rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Groups</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Browse sensor groups, view assigned assets and drill into sensor details without leaving the page. Sliding panels mirror the production Cape dashboard.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-3">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                setSelectedGroupId(group.id);
                setActiveTab('sensors');
                setSelectedSensor(null);
              }}
              className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                selectedGroup?.id === group.id
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-white/10 bg-white/5 text-white hover:border-accent/40 hover:text-accent'
              }`}
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
                <span className="inline-flex items-center gap-2 text-white/60">
                  <MapPin className="h-4 w-4" />
                  {group.location}
                </span>
                <span className={statusTone[group.status] ?? 'text-white/60'}>{group.status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{group.name}</p>
                  <p className="text-xs text-white/60">{group.sensors} sensors • {group.agents} agents • {group.networks} networks • {group.services} services</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">Open</span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          {selectedGroup ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50">Selected group</p>
                  <h3 className="text-lg font-semibold text-white">{selectedGroup.name}</h3>
                </div>
                <div className="flex gap-2">
                  {(['sensors', 'agents', 'networks', 'services'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setSelectedSensor(null);
                      }}
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
                        activeTab === tab ? 'bg-accent/20 text-accent' : 'border border-white/10 text-white/60'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {activeTab === 'sensors' &&
                  (filteredSensors.length ? (
                    filteredSensors.map((sensor) => (
                      <button
                        key={sensor.id}
                        onClick={() => setSelectedSensor(sensor)}
                        className="w-full rounded-2xl border border-white/10 bg-surface/60 p-4 text-left text-sm text-white/80 transition hover:border-accent/40 hover:text-accent"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
                          <span>{sensor.serial}</span>
                          <span className={statusTone[sensor.status] ?? 'text-white/60'}>{sensor.status}</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-white">{sensor.name}</p>
                        <p className="text-xs text-white/60">{sensor.model}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-white/60">No sensors assigned.</p>
                  ))}

                {activeTab === 'agents' &&
                  (filteredAgents.length ? (
                    filteredAgents.map((agent) => (
                      <div key={agent.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
                          <span>{agent.type}</span>
                          <span className={statusTone[agent.status] ?? 'text-white/60'}>{agent.status}</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-white">{agent.name}</p>
                        <p className="text-xs text-white/60">{agent.model}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/60">No agents assigned.</p>
                  ))}

                {activeTab === 'networks' && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-widest text-white/50">Wireless</p>
                    {networks.wireless.map((network) => (
                      <div key={network.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                        <p className="text-base font-semibold text-white">{network.name}</p>
                        <p className="text-xs text-white/60">{network.security} • {network.ipStack}</p>
                      </div>
                    ))}
                    <p className="text-xs uppercase tracking-widest text-white/50">Wired</p>
                    {networks.wired.map((network) => (
                      <div key={network.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                        <p className="text-base font-semibold text-white">{network.name}</p>
                        <p className="text-xs text-white/60">{network.security} • {network.ipStack}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'services' && (
                  <div className="grid gap-3">
                    {services.map((service) => (
                      <div key={service.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
                          <span>{service.category}</span>
                          <span className={statusTone[service.status] ?? 'text-white/60'}>{service.status}</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-white">{service.name}</p>
                        <p className="text-xs text-white/60">{service.target}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/60">Select a group to view details.</p>
          )}
        </div>
      </div>

      {selectedSensor && (
        <div className="pointer-events-auto absolute inset-y-6 right-6 z-40 w-[360px] rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-5 text-sm text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/50">Sensor</p>
              <h3 className="text-lg font-semibold text-white">{selectedSensor.name}</h3>
              <p className="text-xs text-white/60">{selectedSensor.serial}</p>
            </div>
            <button onClick={() => setSelectedSensor(null)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
              Close
            </button>
          </div>
          <div className="mt-4 space-y-2 text-xs uppercase tracking-widest text-white/50">
            <p>Model: <span className="text-white/80">{selectedSensor.model}</span></p>
            <p>Status: <span className={`text-white ${statusTone[selectedSensor.status] ?? 'text-white/80'}`}>{selectedSensor.status}</span></p>
            <p>DPP capable: <span className="text-white/80">{selectedSensor.dppCapable ? 'Yes' : 'No'}</span></p>
          </div>
          <button
            onClick={() => {
              onInspectSensor(selectedSensor.name);
              setSelectedSensor(null);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent"
          >
            Go to sensor status
          </button>
        </div>
      )}
    </section>
  );
}

interface SensorsManagementPageProps {
  sensors: SensorInventoryEntry[];
  onInspect: (sensorName: string) => void;
}

export function SensorsManagementPage({ sensors, onInspect }: SensorsManagementPageProps) {
  const [selectedSensor, setSelectedSensor] = useState<SensorInventoryEntry | null>(null);
  const [activeModal, setActiveModal] = useState<'edit' | 'reboot' | null>(null);

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Sensors</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Master list of UXI sensors with quick actions mirroring the Cape dashboard three-dot menu.</p>
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left text-sm text-white/80">
          <thead className="bg-white/10 text-xs uppercase tracking-widest text-white/60">
            <tr>
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => (
              <tr key={sensor.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{sensor.name}</div>
                  <div className="text-xs text-white/50">Status {sensor.status}</div>
                </td>
                <td className="px-4 py-3">{sensor.serial}</td>
                <td className="px-4 py-3">{sensor.model}</td>
                <td className="px-4 py-3">{sensor.assignedGroup}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSensor(sensor)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 hover:border-accent/40 hover:text-accent"
                    >
                      <Info className="h-4 w-4" /> Info
                    </button>
                    <button
                      onClick={() => onInspect(sensor.name)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 hover:border-accent/40 hover:text-accent"
                    >
                      <Wifi className="h-4 w-4" /> Status page
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSensor(sensor);
                        setActiveModal('edit');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 hover:border-accent/40 hover:text-accent"
                    >
                      <FileEdit className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSensor(sensor);
                        setActiveModal('reboot');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 px-3 py-1 text-[11px] uppercase tracking-widest text-rose-200 hover:bg-rose-500/10"
                    >
                      <Power className="h-4 w-4" /> Reboot
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSensor && !activeModal && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          <h3 className="text-lg font-semibold text-white">{selectedSensor.name}</h3>
          <p className="text-xs text-white/50">Serial {selectedSensor.serial} • {selectedSensor.model}</p>
          <p className="mt-3 text-xs text-white/60">DPP capability: {selectedSensor.dppCapable ? 'Enabled' : 'Not available'}</p>
        </div>
      )}

      {activeModal && selectedSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-6 text-sm text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{activeModal === 'edit' ? 'Edit sensor' : 'Reboot sensor'}</h3>
                <p className="text-xs text-white/60">{selectedSensor.name} • {selectedSensor.serial}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-white/70">
              {activeModal === 'edit'
                ? 'Editing from the mock dashboard is read-only. Use the production console to persist changes.'
                : 'Confirming will queue a reboot on the physical sensor once active captures finish.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setActiveModal(null)} className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/60">
                Cancel
              </button>
              <button onClick={() => setActiveModal(null)} className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent">
                {activeModal === 'edit' ? 'Save' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface AgentsManagementPageProps {
  agents: AgentInventoryEntry[];
}

export function AgentsManagementPage({ agents }: AgentsManagementPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Agents</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Mobile UXI agents with assignment, platform and current online state.</p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <div key={agent.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
              <span>{agent.type}</span>
              <span className={statusTone[agent.status] ?? 'text-white/60'}>{agent.status}</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-white">{agent.name}</p>
            <p className="text-xs text-white/60">{agent.model}</p>
            <p className="mt-2 text-xs text-white/50">Assigned group: {agent.assignedGroup}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface NetworksManagementPageProps {
  networks: { wireless: NetworkEntry[]; wired: NetworkEntry[] };
}

export function NetworksManagementPage({ networks }: NetworksManagementPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Networks</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Wireless and wired network definitions with security, IP stack and assignment metadata.</p>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Wireless</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {networks.wireless.map((network) => (
              <div key={network.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{network.name}</p>
                    <p className="text-xs text-white/60">{network.security} • {network.ipStack}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                    {network.assigned ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">Band lock: {network.bandLock ?? 'Auto'} • Updated {network.modifiedAt}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Wired</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {networks.wired.map((network) => (
              <div key={network.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
                <p className="text-lg font-semibold text-white">{network.name}</p>
                <p className="text-xs text-white/60">{network.security} • {network.ipStack}</p>
                <p className="mt-2 text-xs text-white/50">Updated {network.modifiedAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface ServicesManagementPageProps {
  services: ServiceInventoryEntry[];
  diagnostics: { internal: DiagnosticTest[]; external: DiagnosticTest[] };
}

export function ServicesManagementPage({ services, diagnostics }: ServicesManagementPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Services</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Internal and external tests with quick visibility into latency, loss and jitter charts.</p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <div key={service.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
              <span>{service.category}</span>
              <span className={statusTone[service.status] ?? 'text-white/60'}>{service.status}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{service.name}</p>
            <p className="text-xs text-white/60">{service.target}</p>
            <div className="mt-3 text-xs text-white/60">{service.metrics.length} metric series configured</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <h3 className="text-lg font-semibold text-white">Diagnostics</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {diagnostics.internal.concat(diagnostics.external).map((test) => (
            <div key={test.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
                <span>{diagnostics.internal.some((entry) => entry.id === test.id) ? 'Internal' : 'External'}</span>
                <span className={statusTone[test.status] ?? 'text-white/60'}>{test.status}</span>
              </div>
              <p className="mt-2 text-base font-semibold text-white">{test.name}</p>
              <p className="text-xs text-white/60">{test.target}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export type { GroupsManagementPageProps, SensorsManagementPageProps, AgentsManagementPageProps, NetworksManagementPageProps, ServicesManagementPageProps };
