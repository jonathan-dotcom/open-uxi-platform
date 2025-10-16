import { ArrowUpRight, MapPin } from 'lucide-react';
import { JourneySnapshot } from '../data/sampleData';
import { StatusBadge } from './StatusBadge';

interface JourneyCardProps {
  journey: JourneySnapshot;
}

export function JourneyCard({ journey }: JourneyCardProps) {
  return (
    <article className="flex flex-col rounded-2xl border border-white/5 bg-surface/70 p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{journey.name}</h3>
          <p className="mt-1 text-xs uppercase tracking-wide text-white/50">Synthetic Journey</p>
        </div>
        <StatusBadge status={journey.status} />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-white/50">Success rate</dt>
          <dd className="mt-1 text-2xl font-semibold text-white">{journey.successRate.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-white/50">Median response</dt>
          <dd className="mt-1 text-2xl font-semibold text-white">{journey.responseTimeMs} ms</dd>
        </div>
      </dl>
      <div className="mt-6 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs text-white/60">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Impacted sites
        </div>
        <span className="text-base font-semibold text-white">{journey.impactedSites}</span>
      </div>
      <button className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-accent">
        View waterfall <ArrowUpRight className="h-4 w-4" />
      </button>
    </article>
  );
}
