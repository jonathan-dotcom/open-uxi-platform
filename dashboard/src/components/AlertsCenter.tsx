import { BellRing, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AlertsConfiguration } from '../types';

interface AlertsCenterProps {
  config: AlertsConfiguration;
}

export function AlertsCenter({ config }: AlertsCenterProps) {
  return (
    <section id="alerts" className="mt-10 rounded-3xl border border-white/10 bg-surface/80 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Alerts</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Thresholds & notifications</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Configure Wi‑Fi telemetry thresholds and notification routing. Toggle policies, export muted events and control after-hours email delivery.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70">
          Alert email: {config.alertEmail}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-white">Threshold policies</h3>
              <p className="text-xs text-white/60">Separate warning and error thresholds for every Wi‑Fi metric.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {config.thresholds.map((threshold) => (
              <div key={threshold.id} className="rounded-2xl border border-white/10 bg-surface/70 p-4 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{threshold.name}</p>
                    <p className="text-xs text-white/60">Warning: {threshold.warning}</p>
                    <p className="text-xs text-white/60">Error: {threshold.error}</p>
                  </div>
                  <span className="text-accent">
                    {threshold.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-white/40" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
              <p className="text-xs text-white/60">Mute noisy alerts or set after-hours routing.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Muted alerts</p>
              {config.muted.length === 0 ? (
                <p className="mt-2 text-sm text-white/60">No muted alerts.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {config.muted.map((mute) => (
                    <li key={mute.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="font-semibold text-white">{mute.name}</p>
                      <p className="text-xs text-white/60">Muted by {mute.mutedBy}{mute.expiresAt ? ` • until ${mute.expiresAt}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Email subscriptions</p>
              <ul className="mt-2 space-y-2 text-sm text-white/80">
                {config.subscriptions.map((subscription) => (
                  <li key={subscription.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>
                      <p className="font-semibold text-white">{subscription.label}</p>
                      <p className="text-xs text-white/60">{subscription.schedule === 'after_hours' ? 'After hours' : 'Business hours'} • {subscription.severity.toUpperCase()} alerts</p>
                    </div>
                    <span className="text-accent">
                      {subscription.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-white/40" />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
