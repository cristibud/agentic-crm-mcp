// TypeScript types matching the API/Prisma schema

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'LINKEDIN' | 'COLD_CALL' | 'OTHER';
export type DealStage = 'PROSPECT' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
export type ActivityType =
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'DEAL_CREATED'
  | 'DEAL_STAGE_CHANGED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SIGNED'
  | 'NOTE_ADDED';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  notes?: string | null;
  ownerId?: string | null;
  owner?: User | null;
  deals?: Deal[];
  activities?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  stage: DealStage;
  closedAt?: string | null;
  leadId: string;
  lead?: Lead;
  ownerId?: string | null;
  owner?: User | null;
  contracts?: Contract[];
  activities?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  number: string;
  status: ContractStatus;
  content: string;
  pdfUrl?: string | null;
  signedAt?: string | null;
  dealId: string;
  deal?: Deal & { lead?: Lead };
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  contractId?: string | null;
  createdAt: string;
}

export interface PipelineSummary {
  stage: DealStage;
  count: number;
  totalValue: number;
}

export interface LeadsResponse {
  data: Lead[];
  nextCursor: string | null;
}

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  notes?: string;
}

export interface UpdateLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: LeadSource;
  notes?: string;
  score?: number;
}

export interface CreateDealInput {
  title: string;
  leadId: string;
  value: number;
  probability?: number;
}
