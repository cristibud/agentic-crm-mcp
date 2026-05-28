'use client';

import { useState } from 'react';
import { useContracts } from '@/hooks/useContracts';
import { ContractsTable } from '@/components/contracts/ContractsTable';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'SIGNED', label: 'Signed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function ContractsPage() {
  const [status, setStatus] = useState('');
  const { data: contracts, isLoading } = useContracts({ status });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          {status && (
            <Button variant="ghost" size="sm" onClick={() => setStatus('')}>
              Clear
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {contracts ? `${contracts.length} contract${contracts.length !== 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading contracts...
        </div>
      ) : (
        <ContractsTable contracts={contracts ?? []} />
      )}
    </div>
  );
}
