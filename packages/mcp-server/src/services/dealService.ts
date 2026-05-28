import { apiClient } from '../lib/apiClient.js';
import type { CreateDealInput, Deal, GetPipelineInput, MoveDealStageInput, UpdateDealInput, PipelineSummary } from '../types/index.js';

export const dealService = {
  async createDeal(input: CreateDealInput): Promise<Deal> {
    return apiClient.post('/api/deals', input);
  },

  async moveDealStage(input: MoveDealStageInput): Promise<Deal> {
    return apiClient.put(`/api/deals/${input.dealId}/stage`, { newStage: input.newStage });
  },

  async updateDeal(input: UpdateDealInput): Promise<Deal> {
    const { dealId, ...updates } = input;
    return apiClient.put(`/api/deals/${dealId}`, updates);
  },

  async getPipeline(input: GetPipelineInput): Promise<{ deals: Deal[]; summary: PipelineSummary }> {
    const params = new URLSearchParams();
    if (input.stage) params.set('stage', input.stage);
    if (input.ownerId) params.set('ownerId', input.ownerId);

    const [deals, summary] = await Promise.all([
      apiClient.get<Deal[]>(`/api/deals?${params}`),
      apiClient.get<PipelineSummary>('/api/pipeline/summary'),
    ]);

    return { deals, summary };
  },

  async getAllDeals(): Promise<Deal[]> {
    return apiClient.get('/api/deals');
  },

  async searchDeals(input: {
    leadId?: string;
    stage?: string;
    minValue?: number;
    maxValue?: number;
    minProbability?: number;
    maxProbability?: number;
  }): Promise<Deal[]> {
    const params = new URLSearchParams();
    if (input.leadId) params.set('leadId', input.leadId);
    if (input.stage) params.set('stage', input.stage);
    
    const deals = await apiClient.get<Deal[]>(`/api/deals?${params}`);
    
    // Filter by value and probability if specified
    return deals.filter(d => {
      if (input.minValue !== undefined && d.value < input.minValue) return false;
      if (input.maxValue !== undefined && d.value > input.maxValue) return false;
      
      const prob = d.probability ?? 0;
      if (input.minProbability !== undefined && prob < input.minProbability) return false;
      if (input.maxProbability !== undefined && prob > input.maxProbability) return false;
      
      return true;
    });
  },

  async getPipelineSummary(): Promise<PipelineSummary> {
    return apiClient.get('/api/pipeline/summary');
  },
};
