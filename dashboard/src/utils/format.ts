export function formatPercent(value: number, fractionDigits = 1) {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatLatency(value: number) {
  return `${value.toFixed(0)} ms`;
}

export function formatRate(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k/s`;
  }
  return `${value.toFixed(0)}/s`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    hour12: false,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
