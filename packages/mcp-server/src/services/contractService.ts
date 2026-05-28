import { apiClient } from '../lib/apiClient.js';
import type { Contract, CreateContractInput, ListContractsInput } from '../types/index.js';

export const contractService = {
  async createContract(input: CreateContractInput): Promise<Contract> {
    return apiClient.post('/api/contracts', input);
  },

  async getContractStatus(contractId: string): Promise<Contract> {
    return apiClient.get(`/api/contracts/${contractId}`);
  },

  async listContracts(input: ListContractsInput): Promise<Contract[]> {
    const params = new URLSearchParams();
    if (input.status) params.set('status', input.status);
    if (input.dealId) params.set('dealId', input.dealId);

    return apiClient.get(`/api/contracts?${params}`);
  },

  async getRecentContracts(limit: number = 20): Promise<Contract[]> {
    const contracts = await apiClient.get<Contract[]>('/api/contracts');
    return Array.isArray(contracts) ? contracts.slice(0, limit) : [];
  },
};
