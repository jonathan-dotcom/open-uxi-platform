import { useId } from 'react';
import type { MetricPoint } from '../../types';

interface SparklineProps {
  points: MetricPoint[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  showAxes?: boolean;
}

export function Sparkline({ points, color = '#38bdf8', height = 80, strokeWidth = 2, showAxes = false }: SparklineProps) {
  if (points.length === 0) {
    return <div style={{ height }} />;
  }

  const gradientId = useId();
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = Math.max(points.length * 20, 160);

  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1 || 1)) * width;
      const normalized = (point.value - min) / range;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {showAxes && (
        <g stroke="rgba(148, 163, 184, 0.3)" strokeWidth={1}>
          <line x1={0} y1={0} x2={0} y2={height} />
          <line x1={0} y1={height} x2={width} y2={height} />
        </g>
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coordinates}
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`${color}`} stopOpacity={0.35} />
          <stop offset="100%" stopColor={`${color}`} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradientId})`}
        points={`${coordinates} ${width},${height} 0,${height}`}
        opacity={0.7}
      />
    </svg>
  );
}
