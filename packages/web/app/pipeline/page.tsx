'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDeals } from '@/hooks/useDeals';
import { useLeads } from '@/hooks/useLeads';
import { createDeal, updateDeal } from '@/lib/api';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Deal } from '@/lib/types';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  leadId: z.string().min(1, 'Lead ID is required'),
  value: z.coerce.number().min(0, 'Value must be positive'),
  probability: z.coerce.number().int().min(0).max(100).optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

export default function PipelinePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const { data: deals, isLoading, mutate } = useDeals();
  const { data: leadsData } = useLeads({ limit: 100 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({ resolver: zodResolver(dealSchema) });

  const handleCreate = async (values: DealFormValues) => {
    try {
      if (editingDeal) {
        await updateDeal(editingDeal.id, values);
        toast.success('Deal updated');
        setEditingDeal(null);
      } else {
        await createDeal(values);
        toast.success('Deal created');
      }
      setShowCreate(false);
      reset();
      // Force revalidation to update the board immediately
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : editingDeal ? 'Failed to update deal' : 'Failed to create deal');
    }
  };

  const handleOpenEdit = (deal: Deal) => {
    setEditingDeal(deal);
    reset({
      title: deal.title,
      leadId: deal.leadId,
      value: deal.value,
      probability: deal.probability,
    });
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {deals ? `${deals.length} deal${deals.length !== 1 ? 's' : ''}` : ''}
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deal
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading pipeline...
        </div>
      ) : (
        <KanbanBoard deals={deals ?? []} onUpdate={() => mutate()} onEdit={handleOpenEdit} />
      )}

      <Modal 
        open={showCreate} 
        onClose={() => { 
          setShowCreate(false);
          setEditingDeal(null);
          reset(); 
        }} 
        title={editingDeal ? 'Edit Deal' : 'New Deal'}
      >
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input label="Title" {...register('title')} error={errors.title?.message} />
          <Select
            label="Lead"
            {...register('leadId')}
            error={errors.leadId?.message}
            placeholder="Select a lead"
            options={
              leadsData?.data?.map((lead) => ({
                value: lead.id,
                label: `${lead.name} (${lead.email})`,
              })) || []
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Value (€)" type="number" {...register('value')} error={errors.value?.message} />
            <Input label="Probability (%)" type="number" {...register('probability')} error={errors.probability?.message} />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSubmitting}>
              {editingDeal ? 'Update Deal' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
