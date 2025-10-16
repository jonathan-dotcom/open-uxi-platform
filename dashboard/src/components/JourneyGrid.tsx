import { Layers3 } from 'lucide-react';
import type { JourneySnapshot } from '../types';
import { Card } from './common/Card';
import { JourneyCard } from './JourneyCard';

interface JourneyGridProps {
  journeys: JourneySnapshot[];
}

export function JourneyGrid({ journeys }: JourneyGridProps) {
  const total = journeys.length;
  const degraded = journeys.filter((journey) => journey.status === 'degraded').length;
  const outage = journeys.filter((journey) => journey.status === 'outage').length;

  return (
    <Card
      id="journeys"
      title="Digital experience journeys"
      description="Track SaaS reachability, auth steps, and full web flows."
      action={
        <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          <Layers3 className="h-4 w-4" /> Manage catalog
        </button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-6 text-xs uppercase tracking-wide text-white/60">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white">
          {total} total journeys
        </span>
        <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-warning">
          {degraded} degraded
        </span>
        <span className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-danger">
          {outage} outages
        </span>
      </div>
      <div className="grid gap-4">
        {journeys.map((journey) => (
          <JourneyCard key={journey.id} journey={journey} />
        ))}
      </div>
    </Card>
  );
}
