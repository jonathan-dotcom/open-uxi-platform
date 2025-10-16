import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-danger">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>Unable to refresh from the control plane: {message}</span>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-danger/40 bg-danger/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      >
        <RefreshCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
