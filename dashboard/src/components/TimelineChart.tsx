import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { TimelinePoint } from '../types';
import { Card } from './common/Card';
import { formatTime } from '../utils/format';

interface TimelineChartProps {
  points: TimelinePoint[];
  reportingWindow: string;
}

export function TimelineChart({ points, reportingWindow }: TimelineChartProps) {
  return (
    <Card id="overview" title={reportingWindow} description="Synthetic success rate and network latency.">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#facc15" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#facc15" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(value)} />
            <YAxis yAxisId="left" domain={[80, 100]} tickFormatter={(value) => `${value}%`} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              contentStyle={{
                background: 'rgba(17, 28, 61, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '12px',
                color: '#fff'
              }}
              labelFormatter={(value) => formatTime(String(value))}
            />
            <Legend />
            <Area yAxisId="left" type="monotone" dataKey="successRate" stroke="#0ea5e9" fill="url(#colorSuccess)" name="Success rate" />
            <Area yAxisId="right" type="monotone" dataKey="latencyMs" stroke="#facc15" fill="url(#colorLatency)" name="Latency (ms)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
