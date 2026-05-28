import Cookies from 'js-cookie';
import type {
  Lead,
  LeadsResponse,
  Deal,
  Contract,
  PipelineSummary,
  CreateLeadInput,
  UpdateLeadInput,
  CreateDealInput,
  LeadStatus,
  ContractStatus,
  DealStage,
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getApiKey(): string {
  return Cookies.get('crm_api_key') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Leads

export async function getLeads(params?: {
  status?: string;
  source?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}): Promise<LeadsResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.source) qs.set('source', params.source);
  if (params?.search) qs.set('search', params.search);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  return request<LeadsResponse>(`/leads?${qs}`);
}

export async function getLead(id: string): Promise<Lead> {
  return request<Lead>(`/leads/${id}`);
}

export async function createLead(data: CreateLeadInput): Promise<Lead> {
  return request<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLead(id: string, data: UpdateLeadInput): Promise<Lead> {
  return request<Lead>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  return request<Lead>(`/leads/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export async function deleteLead(id: string): Promise<void> {
  return request<void>(`/leads/${id}`, { method: 'DELETE' });
}

export async function convertLead(id: string): Promise<Deal> {
  return request<Deal>(`/leads/${id}/convert`, { method: 'POST' });
}

// Deals

export async function getDeals(params?: { stage?: string; ownerId?: string }): Promise<Deal[]> {
  const qs = new URLSearchParams();
  if (params?.stage) qs.set('stage', params.stage);
  if (params?.ownerId) qs.set('ownerId', params.ownerId);
  return request<Deal[]>(`/deals?${qs}`);
}

export async function getDeal(id: string): Promise<Deal> {
  return request<Deal>(`/deals/${id}`);
}

export async function createDeal(data: CreateDealInput): Promise<Deal> {
  return request<Deal>('/deals', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeal(id: string, data: Partial<CreateDealInput>): Promise<Deal> {
  return request<Deal>(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function moveDealStage(id: string, newStage: DealStage): Promise<Deal> {
  return request<Deal>(`/deals/${id}/stage`, { method: 'PUT', body: JSON.stringify({ newStage }) });
}

export async function getPipelineSummary(): Promise<PipelineSummary[]> {
  return request<PipelineSummary[]>('/pipeline/summary');
}

// Contracts

export async function getContracts(params?: { status?: string; dealId?: string }): Promise<Contract[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.dealId) qs.set('dealId', params.dealId);
  return request<Contract[]>(`/contracts?${qs}`);
}

export async function getContract(id: string): Promise<Contract> {
  return request<Contract>(`/contracts/${id}`);
}

export async function createContract(dealId: string, content?: string): Promise<Contract> {
  return request<Contract>('/contracts', { method: 'POST', body: JSON.stringify({ dealId, content }) });
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<Contract> {
  return request<Contract>(`/contracts/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export function getContractPdfUrl(id: string): string {
  const apiKey = getApiKey();
  return `${BASE_URL}/api/contracts/${id}/pdf?apiKey=${encodeURIComponent(apiKey)}`;
}

export async function downloadContractPdf(id: string): Promise<Blob> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key missing. Please login again.');
  }
  
  const res = await fetch(`${BASE_URL}/api/contracts/${id}/pdf`, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download PDF');
  }

  return res.blob();
}

// Settings

export interface Settings {
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey?: string;
  updatedAt?: string;
}

export async function getSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) });
}

export const AVAILABLE_MODELS = [
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { value: 'google/gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (reasoning)' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (chat)' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { value: 'qwen/qwen3-30b-a3b', label: 'Qwen3 30B' },
  { value: 'google/gemma-3-27b-it', label: 'Gemma 3 27B' },
];
