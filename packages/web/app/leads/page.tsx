'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';
import { createLead, deleteLead } from '@/lib/api';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadForm } from '@/components/leads/LeadForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { LeadFormValues } from '@/components/leads/LeadForm';

export default function LeadsPage() {
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, mutate } = useLeads({ status, source, search });

  const handleCreate = async (values: LeadFormValues) => {
    try {
      await createLead(values);
      toast.success('Lead created successfully');
      setShowCreate(false);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create lead');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLead(id);
      toast.success('Lead deleted');
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete lead');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LeadFilters
          status={status}
          source={source}
          search={search}
          onStatusChange={setStatus}
          onSourceChange={setSource}
          onSearchChange={setSearch}
          onClear={() => { setStatus(''); setSource(''); setSearch(''); }}
        />
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Lead
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading leads...
        </div>
      ) : (
        <LeadsTable leads={data?.data ?? []} onDelete={handleDelete} />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Lead">
        <LeadForm onSubmit={handleCreate} submitLabel="Create Lead" />
      </Modal>
    </div>
  );
}
