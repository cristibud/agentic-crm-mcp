import useSWR, { type SWRConfiguration } from 'swr';
import { useEffect } from 'react';
import { getContracts } from '@/lib/api';
import type { Contract } from '@/lib/types';

interface UseContractsParams {
  status?: string;
  dealId?: string;
}

export function useContracts(params?: UseContractsParams, config?: SWRConfiguration) {
  const key = ['contracts', params?.status, params?.dealId];
  const result = useSWR<Contract[]>(
    key,
    () => getContracts(params),
    { revalidateOnFocus: false, ...config },
  );

  // Refetch when other components trigger data refresh (e.g., after tool execution)
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing contracts data...');
      result.mutate();
    };
    window.addEventListener('dataRefresh', handleRefresh);
    return () => window.removeEventListener('dataRefresh', handleRefresh);
  }, [result]);

  return result;
}
