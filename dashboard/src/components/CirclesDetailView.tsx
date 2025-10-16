import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Download,
  FileDown,
  Power,
  Share2,
  Wifi
} from 'lucide-react';
import type {
  DiagnosticTest,
  ExperienceSensorOverview,
  ServiceEvent,
  ServiceTestOverview
} from '../types';
import { formatDateTime } from '../utils/format';
import { Sparkline } from './common/Sparkline';

type DetailKind = 'experience' | 'service' | 'internal' | 'external';

export interface CircleDetailState {
  kind: DetailKind;
  item: ExperienceSensorOverview | ServiceTestOverview | DiagnosticTest;
}

interface CirclesDetailViewProps {
  detail: CircleDetailState;
  onBack: () => void;
  experienceTimeRanges: string[];
  serviceTimeRanges: string[];
}

const statusBadge: Record<string, string> = {
  good: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100',
  info: 'border-sky-500/60 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/60 bg-amber-500/10 text-amber-100',
  error: 'border-rose-500/60 bg-rose-500/10 text-rose-100',
  offline: 'border-slate-500/60 bg-slate-600/10 text-slate-100'
};

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  actionLabel?: string;
  onConfirm?: () => void;
  children: React.ReactNode;
}

function Modal({ title, description, onClose, actionLabel, onConfirm, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-6 text-sm text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="mt-1 text-xs text-white/60">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60 hover:border-accent/50 hover:text-accent"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3 text-white/80">{children}</div>
        {actionLabel && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/60"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
              className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent hover:bg-accent/20"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CirclesDetailView({ detail, onBack, experienceTimeRanges, serviceTimeRanges }: CirclesDetailViewProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    detail.kind === 'experience' ? experienceTimeRanges[0] ?? 'Last 60 minutes' : serviceTimeRanges[0] ?? 'Last 60 minutes'
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'actions'>('overview');
  const [pendingAction, setPendingAction] = useState<{ label: string; description: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ServiceEvent | null>(null);

  const status = (detail.item as ExperienceSensorOverview).status ?? 'info';

  const telemetrySeries = useMemo(() => {
    if (detail.kind === 'experience') {
      return (detail.item as ExperienceSensorOverview).performance.map((point) => ({
        timestamp: point.timestamp,
        value: point.latencyMs
      }));
    }
    if (detail.kind === 'service') {
      const series = (detail.item as ServiceTestOverview).metrics[0];
      return series ? series.points : [];
    }
    const series = (detail.item as DiagnosticTest).metrics[0];
    return series ? series.points : [];
  }, [detail]);

  const secondarySeries = useMemo(() => {
    if (detail.kind !== 'experience') {
      return [];
    }
    return (detail.item as ExperienceSensorOverview).performance.map((point) => ({
      timestamp: point.timestamp,
      value: point.availability
    }));
  }, [detail]);

  const actions = detail.kind === 'experience' ? (detail.item as ExperienceSensorOverview).actions : [];

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-white/70 hover:border-accent/50 hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
            {detail.kind === 'experience' && <Wifi className="h-4 w-4" />}
            {detail.kind === 'service' && <Share2 className="h-4 w-4" />}
            {detail.kind === 'internal' && <Activity className="h-4 w-4" />}
            {detail.kind === 'external' && <Share2 className="h-4 w-4" />}
            {detail.kind.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/60">
          <label className="flex items-center gap-2">
            Time range
            <select
              value={selectedTimeRange}
              onChange={(event) => setSelectedTimeRange(event.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white"
            >
              {(detail.kind === 'experience' ? experienceTimeRanges : serviceTimeRanges).map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </label>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-widest ${statusBadge[status] ?? statusBadge.info}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <header>
            <h2 className="text-3xl font-semibold text-white">
              {'name' in detail.item ? detail.item.name : (detail.item as DiagnosticTest).target}
            </h2>
            <p className="mt-2 text-sm text-white/60">
              {detail.kind === 'experience' && (
                <>
                  {(detail.item as ExperienceSensorOverview).location} • {(detail.item as ExperienceSensorOverview).network} • Last updated{' '}
                  {formatDateTime((detail.item as ExperienceSensorOverview).lastUpdated)}
                </>
              )}
              {detail.kind === 'service' && `${(detail.item as ServiceTestOverview).category} service test`}
              {(detail.kind === 'internal' || detail.kind === 'external') && (
                <>
                  Target {(detail.item as DiagnosticTest).target} • {(detail.item as DiagnosticTest).frequency}
                </>
              )}
            </p>
          </header>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Telemetry</p>
                <h3 className="text-lg font-semibold text-white">Latency and availability</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                {telemetrySeries.length} points
              </div>
            </div>
            <div className="mt-4 h-56 w-full rounded-2xl border border-white/5 bg-[#0f223f]/60 p-3">
              <Sparkline points={telemetrySeries} color="#38bdf8" />
            </div>
            {secondarySeries.length > 0 && (
              <div className="mt-4 h-32 w-full rounded-2xl border border-white/5 bg-[#0f223f]/60 p-3">
                <Sparkline points={secondarySeries} color="#34d399" />
              </div>
            )}
          </div>

          {detail.kind === 'experience' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Wi‑Fi metrics</h3>
                  <div className="text-xs uppercase tracking-widest text-white/50">
                    SSID {(detail.item as ExperienceSensorOverview).network} • BSSID {(detail.item as ExperienceSensorOverview).wifiDetails.bssid}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(detail.item as ExperienceSensorOverview).metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
                      <p className="text-[11px] uppercase tracking-widest text-white/50">{metric.label}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{metric.value}</p>
                      {metric.helper && <p className="text-xs text-white/60">{metric.helper}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Actions</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
                        activeTab === 'overview' ? 'bg-accent/20 text-accent' : 'border border-white/10 text-white/60'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('actions')}
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
                        activeTab === 'actions' ? 'bg-accent/20 text-accent' : 'border border-white/10 text-white/60'
                      }`}
                    >
                      Command
                    </button>
                  </div>
                </div>
                {activeTab === 'overview' ? (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <p>
                      Download the most recent RF telemetry, request a targeted packet capture or perform a maintenance reboot. These operations
                      mirror the Cape Networks experience.
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-white/60">
                      <li>Telemetry exports respect the selected time range.</li>
                      <li>Packet captures require sensors to be online and will pause background tests.</li>
                      <li>Reboots execute after active captures or service tests complete.</li>
                    </ul>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => setPendingAction({ label: action.label, description: action.description })}
                        className="inline-flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-left text-sm font-semibold text-accent shadow-[0_0_0_1px_rgba(59,130,246,0.1)] transition hover:bg-accent/20"
                      >
                        <span>{action.label}</span>
                        {action.id === 'raw-data' && <Download className="h-4 w-4" />}
                        {action.id === 'pcap' && <FileDown className="h-4 w-4" />}
                        {action.id === 'reboot' && <Power className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {detail.kind === 'service' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-semibold text-white">Events</h3>
                <p className="text-xs text-white/60">Current investigations and root-cause analysis.</p>
                <div className="mt-4 space-y-3">
                  {(detail.item as ServiceTestOverview).ongoingEvents.length === 0 ? (
                    <p className="text-sm text-white/60">No active events.</p>
                  ) : (
                    (detail.item as ServiceTestOverview).ongoingEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full rounded-2xl border border-white/10 bg-surface/60 p-4 text-left text-sm text-white/80 transition hover:border-accent/40 hover:text-accent"
                      >
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-white/50">
                          <span className="text-accent">{event.severity}</span>
                          <span>{formatDateTime(event.detectedAt)}</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-white/60">Tap to review actions</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {(detail.kind === 'internal' || detail.kind === 'external') && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <h3 className="text-lg font-semibold text-white">About this test</h3>
              <p className="mt-2 text-sm text-white/70">{(detail.item as DiagnosticTest).about}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-xs uppercase tracking-widest text-white/50">
                <div>
                  <dt>Latency (RTT)</dt>
                  <dd className="text-white">{(detail.item as DiagnosticTest).latencyMs} ms</dd>
                </div>
                <div>
                  <dt>Packet loss</dt>
                  <dd className="text-white">{(detail.item as DiagnosticTest).packetLoss}%</dd>
                </div>
                <div>
                  <dt>Jitter</dt>
                  <dd className="text-white">{(detail.item as DiagnosticTest).jitterMs} ms</dd>
                </div>
                <div>
                  <dt>Frequency</dt>
                  <dd className="text-white">{(detail.item as DiagnosticTest).frequency}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {detail.kind === 'experience' && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <h3 className="text-lg font-semibold text-white">SSID & BSSID</h3>
              <dl className="mt-4 space-y-2 text-xs uppercase tracking-widest text-white/50">
                <div>
                  <dt>SSID</dt>
                  <dd className="text-white">{(detail.item as ExperienceSensorOverview).network}</dd>
                </div>
                <div>
                  <dt>BSSID</dt>
                  <dd className="text-white">{(detail.item as ExperienceSensorOverview).wifiDetails.bssid}</dd>
                </div>
                <div>
                  <dt>Band</dt>
                  <dd className="text-white">{(detail.item as ExperienceSensorOverview).wifiDetails.band}</dd>
                </div>
                <div>
                  <dt>Channel</dt>
                  <dd className="text-white">{(detail.item as ExperienceSensorOverview).wifiDetails.channel}</dd>
                </div>
              </dl>
            </div>
          )}

          {detail.kind === 'service' && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <h3 className="text-lg font-semibold text-white">Test summary</h3>
              <p className="mt-2 text-xs text-white/60">
                {(detail.item as ServiceTestOverview).ongoingEvents.length} active issues • Status {(detail.item as ServiceTestOverview).status}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-white/60">
                <li>Category: {(detail.item as ServiceTestOverview).category}</li>
                <li>Metrics captured: {(detail.item as ServiceTestOverview).metrics.length}</li>
                <li>Actions: Download PCAP, Export report, Share issue</li>
              </ul>
            </div>
          )}

          {(detail.kind === 'internal' || detail.kind === 'external') && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <h3 className="text-lg font-semibold text-white">Test configuration</h3>
              <ul className="mt-3 space-y-2 text-xs text-white/60">
                {(detail.item as DiagnosticTest).metrics.map((metric) => (
                  <li key={metric.id}>
                    {metric.label} ({metric.unit}) – {metric.points[metric.points.length - 1]?.value ?? '--'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {pendingAction && (
        <Modal
          title={pendingAction.label}
          description={pendingAction.description}
          onClose={() => setPendingAction(null)}
          actionLabel="Confirm"
        >
          <p className="text-sm text-white/70">
            This action will execute immediately on the selected sensor. You will receive a confirmation notification once it completes.
          </p>
        </Modal>
      )}

      {selectedEvent && (
        <Modal
          title={selectedEvent.title}
          description={formatDateTime(selectedEvent.detectedAt)}
          onClose={() => setSelectedEvent(null)}
          actionLabel="Download PCAP"
        >
          <p className="text-sm text-white/70">{selectedEvent.rootCause}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedEvent.actions.map((action) => (
              <span key={action.id} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-widest text-accent">
                {action.label}
              </span>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
