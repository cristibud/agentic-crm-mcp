import { apiClient } from '../lib/apiClient.js';
import type { CreateLeadInput, Lead, SearchLeadsInput, UpdateLeadStatusInput } from '../types/index.js';

export const leadService = {
  async createLead(input: CreateLeadInput): Promise<Lead> {
    return apiClient.post('/api/leads', input);
  },

  async updateLead(leadId: string, updates: Partial<CreateLeadInput>): Promise<Lead> {
    return apiClient.put(`/api/leads/${leadId}`, updates);
  },

  async updateLeadStatus(input: UpdateLeadStatusInput): Promise<Lead> {
    return apiClient.put(`/api/leads/${input.leadId}/status`, { status: input.status });
  },

  async searchLeads(input: SearchLeadsInput): Promise<Lead[]> {
    const params = new URLSearchParams();
    if (input.query) params.set('search', input.query);
    if (input.status) params.set('status', input.status);
    if (input.source) params.set('source', input.source);
    if (input.limit) params.set('limit', String(input.limit));

    const result = await apiClient.get<{ data: Lead[] }>(`/api/leads?${params}`);
    return result.data;
  },

  async getAllLeads(limit: number = 100): Promise<Lead[]> {
    const result = await apiClient.get<{ data: Lead[] }>(`/api/leads?limit=${limit}`);
    return result.data;
  },
};
