'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Lead } from '@/lib/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'LINKEDIN', 'COLD_CALL', 'OTHER']),
  notes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof schema>;

const sourceOptions = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'COLD_CALL', label: 'Cold Call' },
  { value: 'OTHER', label: 'Other' },
];

interface LeadFormProps {
  defaultValues?: Partial<Lead>;
  onSubmit: (data: LeadFormValues) => Promise<void>;
  submitLabel?: string;
}

export function LeadForm({ defaultValues, onSubmit, submitLabel = 'Save' }: LeadFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      company: defaultValues?.company ?? '',
      source: defaultValues?.source ?? 'WEBSITE',
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Name" {...register('name')} error={errors.name?.message} />
      <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
        <Input label="Company" {...register('company')} error={errors.company?.message} />
      </div>
      <Select
        label="Source"
        options={sourceOptions}
        {...register('source')}
        error={errors.source?.message}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
