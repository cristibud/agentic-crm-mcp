'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getContract } from '@/lib/api';
import { ContractDetail } from '@/components/contracts/ContractDetail';
import { Button } from '@/components/ui/Button';
import type { Contract } from '@/lib/types';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: contract, isLoading, mutate } = useSWR(
    id ? ['contract', id] : null,
    () => getContract(id),
  );

  const [localContract, setLocalContract] = useState<Contract | null>(null);
  const displayed = localContract ?? contract;

  const handleUpdate = (updated: Contract) => {
    setLocalContract(updated);
    mutate(updated, false);
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

  if (!displayed) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p>Contract not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/contracts')}>
          ← Back to Contracts
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <button
        onClick={() => router.push('/contracts')}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Contracts
      </button>

      <ContractDetail contract={displayed} onUpdate={handleUpdate} />
    </div>
  );
}
