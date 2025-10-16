import { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  icon: ReactNode;
  subtitle?: string;
  changeLabel?: string;
}

export function KpiCard({ title, value, change, icon, subtitle, changeLabel }: KpiCardProps) {
  const positive = change >= 0;
  return (
    <div className="rounded-2xl border border-white/5 bg-surface/80 p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
        </div>
        <div className="rounded-full bg-accent/10 p-3 text-accent">{icon}</div>
      </div>
      <div
        className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          positive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
        }`}
      >
        {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {positive ? '+' : ''}
        {change.toFixed(1)}%
        {changeLabel ? ` ${changeLabel}` : ' vs 24h'}
      </div>
    </div>
  );
}
