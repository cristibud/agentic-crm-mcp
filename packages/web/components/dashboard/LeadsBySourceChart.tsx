'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Lead } from '@/lib/types';

const COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

const sourceLabels: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  LINKEDIN: 'LinkedIn',
  COLD_CALL: 'Cold Call',
  OTHER: 'Other',
};

interface LeadsBySourceChartProps {
  leads: Lead[];
}

export function LeadsBySourceChart({ leads }: LeadsBySourceChartProps) {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    counts[lead.source] = (counts[lead.source] || 0) + 1;
  }
  const data = Object.entries(counts).map(([source, value]) => ({
    name: sourceLabels[source] ?? source,
    value,
  }));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Leads by Source</h3>
        <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Leads by Source</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
