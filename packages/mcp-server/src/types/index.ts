// Lead types
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'LINKEDIN' | 'COLD_CALL' | 'OTHER';

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  notes?: string;
}

export interface UpdateLeadStatusInput {
  leadId: string;
  status: LeadStatus;
}

export interface SearchLeadsInput {
  query?: string;
  status?: LeadStatus;
  source?: LeadSource;
  limit?: number;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  notes?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

// Deal types
export type DealStage = 'PROSPECT' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

export interface CreateDealInput {
  title: string;
  leadId: string;
  value: number;
  probability?: number;
}

export interface MoveDealStageInput {
  dealId: string;
  newStage: DealStage;
}

export interface UpdateDealInput {
  dealId: string;
  title?: string;
  value?: number;
  probability?: number;
}

export interface GetPipelineInput {
  stage?: DealStage;
  ownerId?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  stage: DealStage;
  leadId: string;
  ownerId?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineSummary {
  totalDeals: number;
  totalValue: number;
  byStage: Record<DealStage, { count: number; value: number }>;
}

// Contract types
export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';

export interface CreateContractInput {
  dealId: string;
  template?: string;
}

export interface ListContractsInput {
  status?: ContractStatus;
  dealId?: string;
}

export interface Contract {
  id: string;
  number: string;
  status: ContractStatus;
  content: string;
  pdfUrl?: string;
  dealId: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Re-export specialized types from their modules
export type { ToolResult, ExecutionTrace, OrchestrationResult, PendingPlanState } from './ToolExecution.js';
export type { PlanStep, ExecutionPlan, ParameterExtractionResult } from './Planning.js';
export type { ValidationError, MissingParametersInfo } from './Validation.js';
export type { ContextMemory, ConversationMessage, ActionHistoryEntry } from './ContextMemory.js';
export type { ToolRegistry } from './ToolRegistry.js';
