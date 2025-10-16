import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { AlertEvent } from '../types';
import { Card } from './common/Card';
import { formatDateTime } from '../utils/format';

interface AlertsPanelProps {
  alerts: AlertEvent[];
}

const severityConfig = {
  critical: { icon: ShieldAlert, className: 'border-danger/40 bg-danger/15 text-danger', label: 'Critical' },
  warning: { icon: AlertCircle, className: 'border-warning/40 bg-warning/15 text-warning', label: 'Warning' },
  info: { icon: Info, className: 'border-white/20 bg-white/10 text-white/70', label: 'Info' }
} as const;

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card id="alerts" title="Active incidents" description="Detect outages early and acknowledge remediated issues.">
      <div className="flex flex-col gap-4">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;
          return (
            <article
              key={alert.id}
              className={`flex flex-col gap-3 rounded-xl border px-4 py-4 text-sm ${config.className}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{config.label}</span>
                </div>
                <time className="text-xs text-white/70">{formatDateTime(alert.detectedAt)}</time>
              </div>
              <p className="text-base font-semibold text-white">{alert.summary}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-wide">
                  {alert.affectedSites} site{alert.affectedSites === 1 ? '' : 's'} impacted
                </span>
                {alert.impactedJourneys.length > 0 ? (
                  <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-wide">
                    {alert.impactedJourneys.join(', ')}
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1 uppercase tracking-wide text-white/50">
                    No journeys impacted
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 uppercase tracking-wide">
                  {alert.acknowledged ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Acknowledged
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-danger" />
                      Unacknowledged
                    </>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
