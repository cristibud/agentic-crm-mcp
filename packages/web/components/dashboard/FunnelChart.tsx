'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { PipelineSummary } from '@/lib/types';

const COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];

interface FunnelChartProps {
  data: PipelineSummary[];
}

const stageLabels: Record<string, string> = {
  PROSPECT: 'Prospect',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export function FunnelChart({ data }: FunnelChartProps) {
  const chartData = data.map((d) => ({
    name: stageLabels[d.stage] ?? d.stage,
    count: d.count,
    value: d.totalValue,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Deals by Stage</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === 'count' ? [value, 'Deals'] : [`€${value.toLocaleString()}`, 'Value']
            }
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
