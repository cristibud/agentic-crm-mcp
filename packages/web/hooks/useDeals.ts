import useSWR, { type SWRConfiguration } from 'swr';
import { useEffect } from 'react';
import { getDeals, getPipelineSummary } from '@/lib/api';
import type { Deal, PipelineSummary } from '@/lib/types';

interface UseDealsParams {
  stage?: string;
  ownerId?: string;
}

export function useDeals(params?: UseDealsParams, config?: SWRConfiguration) {
  const key = ['deals', params?.stage, params?.ownerId];
  const result = useSWR<Deal[]>(
    key,
    () => getDeals(params),
    { revalidateOnFocus: false, ...config },
  );

  // Refetch when other components trigger data refresh (e.g., after tool execution)
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing deals data...');
      result.mutate();
    };
    window.addEventListener('dataRefresh', handleRefresh);
    return () => window.removeEventListener('dataRefresh', handleRefresh);
  }, [result]);

  return result;
}

export function usePipelineSummary(config?: SWRConfiguration) {
  const result = useSWR<PipelineSummary[]>(
    'pipeline-summary',
    () => getPipelineSummary(),
    { revalidateOnFocus: false, ...config },
  );

  // Refetch when other components trigger data refresh
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing pipeline summary...');
      result.mutate();
    };
    window.addEventListener('dataRefresh', handleRefresh);
    return () => window.removeEventListener('dataRefresh', handleRefresh);
  }, [result]);

  return result;
}
