import { useState } from 'react';
import { BellRing, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import type { MuteEntry, NotificationPreference, ThresholdSetting } from '../../types';

interface AlertsThresholdsPageProps {
  thresholds: ThresholdSetting[];
}

export function AlertsThresholdsPage({ thresholds }: AlertsThresholdsPageProps) {
  const [selectedThreshold, setSelectedThreshold] = useState<ThresholdSetting | null>(null);

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Alerts</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Threshold policies</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Define warning and error conditions for Wi‑Fi metrics such as RSSI, bitrate and retry rate.</p>
        </div>
      </header>

      <div className="mt-6 space-y-3">
        {thresholds.map((threshold) => (
          <button
            key={threshold.id}
            onClick={() => setSelectedThreshold(threshold)}
            className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm text-white/80 transition hover:border-accent/50 hover:text-accent"
          >
            <div>
              <p className="text-base font-semibold text-white">{threshold.name}</p>
              <p className="text-xs text-white/60">Warning: {threshold.warning}</p>
              <p className="text-xs text-white/60">Error: {threshold.error}</p>
            </div>
            <span className="text-accent">{threshold.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-white/40" />}</span>
          </button>
        ))}
      </div>

      {selectedThreshold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-6 text-sm text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Edit threshold</h3>
                <p className="text-xs text-white/60">{selectedThreshold.name}</p>
              </div>
              <button onClick={() => setSelectedThreshold(null)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-white/70">
              Adjust warning and error levels from the production console. This mock experience displays the Cape Networks modal layout.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

interface AlertsNotificationsPageProps {
  muted: MuteEntry[];
  subscriptions: NotificationPreference[];
  alertEmail: string;
}

export function AlertsNotificationsPage({ muted, subscriptions, alertEmail }: AlertsNotificationsPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Alerts</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Notifications</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Mute noisy alerts, subscribe to email updates and configure after-hours routing.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/70">
          Alert email: {alertEmail}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-white">Muted alerts</h3>
              <p className="text-xs text-white/60">Rules temporarily silencing notifications.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {muted.length === 0 ? (
              <p className="text-sm text-white/60">No muted alerts.</p>
            ) : (
              muted.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                  <p className="text-base font-semibold text-white">{entry.name}</p>
                  <p className="text-xs text-white/60">Muted by {entry.mutedBy}{entry.expiresAt ? ` • until ${entry.expiresAt}` : ''}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-white">Email subscriptions</h3>
              <p className="text-xs text-white/60">Business hours and after-hours routing options.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface/60 p-4">
                <div>
                  <p className="text-base font-semibold text-white">{subscription.label}</p>
                  <p className="text-xs text-white/60">{subscription.schedule === 'after_hours' ? 'After hours' : 'Business hours'} • {subscription.severity.toUpperCase()} alerts</p>
                </div>
                <span className="text-accent">{subscription.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-white/40" />}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export type { AlertsThresholdsPageProps, AlertsNotificationsPageProps };
