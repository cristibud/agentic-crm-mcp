'use client';

import useSWR from 'swr';
import { getLeads, getDeals, getContracts, getPipelineSummary } from '@/lib/api';
import { KPICard } from '@/components/dashboard/KPICard';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { LeadsBySourceChart } from '@/components/dashboard/LeadsBySourceChart';
import { ContractsTrendChart } from '@/components/dashboard/ContractsTrendChart';

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export default function DashboardPage() {
  const { data: leadsRes } = useSWR('dashboard-leads', () => getLeads({ limit: 100 }));
  const { data: deals } = useSWR('dashboard-deals', () => getDeals());
  const { data: contracts } = useSWR('dashboard-contracts', () => getContracts());
  const { data: pipeline } = useSWR('dashboard-pipeline', () => getPipelineSummary());

  const cutoff = sevenDaysAgo();
  const newLeads7d = leadsRes?.data.filter((l) => l.createdAt >= cutoff).length ?? 0;
  const activeDeals = deals?.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST').length ?? 0;
  const pendingContracts = contracts?.filter((c) => c.status === 'DRAFT' || c.status === 'SENT').length ?? 0;
  const pipelineValue = deals
    ?.filter((d) => d.stage !== 'LOST')
    .reduce((s, d) => s + d.value, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="New Leads (7 days)"
          value={newLeads7d}
          color="indigo"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <KPICard
          title="Active Deals"
          value={activeDeals}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KPICard
          title="Pending Contracts"
          value={pendingContracts}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <KPICard
          title="Pipeline Value"
          value={`€${pipelineValue.toLocaleString()}`}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart data={pipeline ?? []} />
        <LeadsBySourceChart leads={leadsRes?.data ?? []} />
      </div>

      {/* Charts row 2 */}
      <ContractsTrendChart />
    </div>
  );
}
