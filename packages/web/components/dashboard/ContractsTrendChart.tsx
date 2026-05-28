'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useContracts } from '@/hooks/useContracts';

function generateChartData(contracts: any[]) {
  // Create a map for last 30 days
  const data: Record<string, number> = {};
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    data[dateKey] = 0;
    // Store the label for later use
    (data as any)[`${dateKey}_label`] = dateLabel;
  }

  // Count contracts by creation date
  contracts?.forEach((contract) => {
    const createdDate = new Date(contract.createdAt);
    const dateKey = createdDate.toISOString().split('T')[0];
    if (data[dateKey] !== undefined) {
      data[dateKey]++;
    }
  });

  // Convert to chart format
  const chartData = [];
  const now2 = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now2);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    chartData.push({
      date: dateLabel,
      contracts: data[dateKey] || 0,
    });
  }

  return chartData;
}

export function ContractsTrendChart() {
  const { data: contracts = [] } = useContracts();
  
  const chartData = useMemo(() => {
    return generateChartData(contracts);
  }, [contracts]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Contracts Trend (30 days)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="contracts"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
