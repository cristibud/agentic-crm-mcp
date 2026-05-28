'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { getLead, updateLead, convertLead } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LeadForm } from '@/components/leads/LeadForm';
import { LeadStatusBadge, LeadSourceBadge, DealStageBadge } from '@/components/ui/Badge';
import type { LeadFormValues } from '@/components/leads/LeadForm';

const activityIcons: Record<string, string> = {
  LEAD_CREATED: '🟢',
  LEAD_UPDATED: '✏️',
  DEAL_CREATED: '💼',
  DEAL_STAGE_CHANGED: '🔄',
  CONTRACT_CREATED: '📄',
  CONTRACT_SIGNED: '✅',
  NOTE_ADDED: '📝',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);

  const { data: lead, isLoading, mutate } = useSWR(
    id ? ['lead', id] : null,
    () => getLead(id),
  );

  const handleEdit = async (values: LeadFormValues) => {
    try {
      await updateLead(id, values);
      toast.success('Lead updated');
      setEditing(false);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update lead');
    }
  };

  const handleConvert = async () => {
    if (!confirm('Convert this lead to a deal?')) return;
    setConverting(true);
    try {
      await convertLead(id);
      toast.success('Lead converted to deal!');
      mutate();
      router.push('/pipeline');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to convert lead');
    } finally {
      setConverting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p>Lead not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/leads')}>
          ← Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => router.push('/leads')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Leads
        </button>
        <div className="flex gap-2">
          {lead.status !== 'CONVERTED' && (
            <Button variant="secondary" size="sm" loading={converting} onClick={handleConvert}>
              Convert to Deal
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
            <p className="text-gray-500 text-sm mt-0.5">{lead.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <LeadSourceBadge source={lead.source} />
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
          <InfoField label="Phone" value={lead.phone || '—'} />
          <InfoField label="Company" value={lead.company || '—'} />
          <InfoField label="Score" value={`${lead.score}/100`} />
          <InfoField
            label="Created"
            value={new Date(lead.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          />
          {lead.notes && (
            <div className="col-span-full">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
              <p className="text-sm text-gray-700 mt-1">{lead.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {(lead.deals?.length ?? 0) > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Associated Deals</h3>
          <div className="space-y-3">
            {lead.deals!.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                  <p className="text-xs text-gray-500">€{deal.value.toLocaleString()}</p>
                </div>
                <DealStageBadge stage={deal.stage} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {(lead.activities?.length ?? 0) > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          <div className="space-y-3">
            {lead.activities!.map((activity) => (
              <div key={activity.id} className="flex gap-3 text-sm">
                <span className="text-lg leading-none mt-0.5">
                  {activityIcons[activity.type] ?? '•'}
                </span>
                <div>
                  <p className="text-gray-800">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(activity.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Lead">
        <LeadForm defaultValues={lead} onSubmit={handleEdit} submitLabel="Save Changes" />
      </Modal>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1">{value}</p>
    </div>
  );
}
