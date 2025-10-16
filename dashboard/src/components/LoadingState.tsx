import { Loader2 } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="mb-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      Fetching the latest pipeline snapshot…
    </div>
  );
}
