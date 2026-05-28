import useSWR, { type SWRConfiguration } from 'swr';
import { useEffect } from 'react';
import { getLeads } from '@/lib/api';
import type { LeadsResponse } from '@/lib/types';

interface UseLeadsParams {
  status?: string;
  source?: string;
  search?: string;
  limit?: number;
}

export function useLeads(params?: UseLeadsParams, config?: SWRConfiguration) {
  const key = ['leads', params?.status, params?.source, params?.search, params?.limit];
  const result = useSWR<LeadsResponse>(
    key,
    () => getLeads(params),
    { revalidateOnFocus: false, ...config },
  );

  // Refetch when other components trigger data refresh (e.g., after tool execution)
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing leads data...');
      result.mutate();
    };
    window.addEventListener('dataRefresh', handleRefresh);
    return () => window.removeEventListener('dataRefresh', handleRefresh);
  }, [result]);

  return result;
}
