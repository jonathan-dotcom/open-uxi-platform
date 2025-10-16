import { clsx } from 'clsx';
import type { ServiceStatus } from '../data/sampleData';

interface StatusBadgeProps {
  status: ServiceStatus;
}

const statusConfig: Record<ServiceStatus, { label: string; className: string }> = {
  operational: { label: 'Operational', className: 'bg-success/20 text-success border-success/50' },
  degraded: { label: 'Degraded', className: 'bg-warning/20 text-warning border-warning/40' },
  outage: { label: 'Outage', className: 'bg-danger/20 text-danger border-danger/40' }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase', config.className)}>
      {config.label}
    </span>
  );
}
