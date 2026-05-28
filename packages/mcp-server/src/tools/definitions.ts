import { z } from 'zod';
import { leadService } from '../services/leadService.js';
import { dealService } from '../services/dealService.js';
import { contractService } from '../services/contractService.js';

export interface ToolConfig {
  name: string;
  description: string;
  category?: 'search' | 'create' | 'mutation' | 'read';
  schema: Record<string, any>;
  executor: (args: any) => Promise<any>;
  outputFields?: string[];
  idFields?: string[];
  idMapping?: Record<string, string>;
}

export interface MCPToolConfig extends ToolConfig {
  mcpHandler?: (args: any) => Promise<any>;
}

export const LEAD_TOOLS: MCPToolConfig[] = [
  {
    name: 'create_lead',
    description: 'Create a new lead in the CRM',
    category: 'create',
    schema: {
      name: z.string().describe('Full name of the lead'),
      email: z.string().email().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      company: z.string().optional().describe('Company name'),
      source: z.enum(['WEBSITE', 'REFERRAL', 'LINKEDIN', 'COLD_CALL', 'OTHER']).describe('Lead source'),
      notes: z.string().optional().describe('Additional notes'),
    },
    executor: async (args: any) => {
      return leadService.createLead(args);
    },
    mcpHandler: async (args: any) => {
      const lead = await leadService.createLead(args);
      return { content: [{ type: 'text', text: JSON.stringify(lead, null, 2) }] };
    },
    outputFields: ['id'],
    idMapping: { id: 'lead' },
  },
  {
    name: 'update_lead_status',
    description: 'Update the status of a lead',
    category: 'mutation',
    schema: {
      leadId: z.string().describe('Lead ID'),
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).describe('New status'),
    },
    executor: async (args: any) => {
      return leadService.updateLeadStatus(args);
    },
    mcpHandler: async (args: any) => {
      const lead = await leadService.updateLeadStatus(args);
      return { content: [{ type: 'text', text: JSON.stringify(lead, null, 2) }] };
    },
    idFields: ['leadId'],
    outputFields: ['id'],
    idMapping: { leadId: 'lead', id: 'lead' },
  },
  {
    name: 'update_lead',
    description: 'Update lead information (name, email, phone, company, notes)',
    category: 'mutation',
    schema: {
      leadId: z.string().describe('Lead ID'),
      name: z.string().optional().describe('Updated name'),
      email: z.string().email().optional().describe('Updated email'),
      phone: z.string().optional().describe('Updated phone'),
      company: z.string().optional().describe('Updated company'),
      notes: z.string().optional().describe('Updated notes'),
    },
    executor: async (args: any) => {
      const { leadId, ...updates } = args;
      return leadService.updateLead(leadId, updates);
    },
    mcpHandler: async (args: any) => {
      const { leadId, ...updates } = args;
      const lead = await leadService.updateLead(leadId, updates);
      return { content: [{ type: 'text', text: JSON.stringify(lead, null, 2) }] };
    },
    idFields: ['leadId'],
    outputFields: ['id'],
    idMapping: { leadId: 'lead', id: 'lead' },
  },
  {
    name: 'search_leads',
    description: 'Search for leads in the CRM',
    category: 'search',
    schema: {
      query: z.string().optional().describe('Search query (name, email, company)'),
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional().describe('Filter by status'),
      source: z.enum(['WEBSITE', 'REFERRAL', 'LINKEDIN', 'COLD_CALL', 'OTHER']).optional().describe('Filter by source'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    executor: async (args: any) => {
      return leadService.searchLeads(args);
    },
    mcpHandler: async (args: any) => {
      const leads = await leadService.searchLeads(args);
      return { content: [{ type: 'text', text: JSON.stringify(leads, null, 2) }] };
    },
    outputFields: ['id'],
    idMapping: { id: 'lead' },
  },
];

export const DEAL_TOOLS: MCPToolConfig[] = [
  {
    name: 'create_deal',
    description: 'Create a new deal in the CRM',
    category: 'create',
    schema: {
      title: z.string().describe('Deal title'),
      leadId: z.string().describe('Associated lead ID'),
      value: z.number().min(0).describe('Deal value'),
      probability: z.number().int().min(0).max(100).optional().describe('Win probability (%)'),
    },
    executor: async (args: any) => {
      return dealService.createDeal(args);
    },
    mcpHandler: async (args: any) => {
      const deal = await dealService.createDeal(args);
      return { content: [{ type: 'text', text: JSON.stringify(deal, null, 2) }] };
    },
    idFields: ['leadId'],
    outputFields: ['id'],
    idMapping: { leadId: 'lead', id: 'deal' },
  },
  {
    name: 'move_deal_stage',
    description: 'Move a deal to a different stage',
    category: 'mutation',
    schema: {
      dealId: z.string().describe('Deal ID'),
      newStage: z.enum(['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).describe('Target stage'),
    },
    executor: async (args: any) => {
      return dealService.moveDealStage(args);
    },
    mcpHandler: async (args: any) => {
      const deal = await dealService.moveDealStage(args);
      return { content: [{ type: 'text', text: JSON.stringify(deal, null, 2) }] };
    },
    idFields: ['dealId'],
    outputFields: ['id'],
    idMapping: { dealId: 'deal', id: 'deal' },
  },
  {
    name: 'update_deal',
    description: 'Update deal information (title, value, or probability)',
    category: 'mutation',
    schema: {
      dealId: z.string().describe('Deal ID'),
      title: z.string().optional().describe('Updated deal title'),
      value: z.number().min(0).optional().describe('Updated deal value'),
      probability: z.number().int().min(0).max(100).optional().describe('Updated win probability (%)'),
    },
    executor: async (args: any) => {
      return dealService.updateDeal(args);
    },
    mcpHandler: async (args: any) => {
      const deal = await dealService.updateDeal(args);
      return { content: [{ type: 'text', text: JSON.stringify(deal, null, 2) }] };
    },
    idFields: ['dealId'],
    outputFields: ['id'],
    idMapping: { dealId: 'deal', id: 'deal' },
  },
  {
    name: 'get_pipeline',
    description: 'Get the sales pipeline with deals and summary',
    category: 'read',
    schema: {
      stage: z.enum(['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional().describe('Filter by stage'),
      ownerId: z.string().optional().describe('Filter by owner ID'),
    },
    executor: async (args: any) => {
      return dealService.getPipeline(args);
    },
    mcpHandler: async (args: any) => {
      const result = await dealService.getPipeline(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    outputFields: ['id'],
    idMapping: { id: 'deal' },
  },
  {
    name: 'search_deals',
    description: 'Search for deals with optional filters (by lead, stage, probability, value)',
    category: 'search',
    schema: {
      leadId: z.string().optional().describe('Filter by lead ID'),
      stage: z.enum(['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional().describe('Filter by deal stage'),
      minValue: z.number().min(0).optional().describe('Minimum deal value'),
      maxValue: z.number().min(0).optional().describe('Maximum deal value'),
      minProbability: z.number().int().min(0).max(100).optional().describe('Minimum win probability (%)'),
      maxProbability: z.number().int().min(0).max(100).optional().describe('Maximum win probability (%)'),
    },
    executor: async (args: any) => {
      return dealService.searchDeals(args);
    },
    mcpHandler: async (args: any) => {
      const deals = await dealService.searchDeals(args);
      return { content: [{ type: 'text', text: JSON.stringify(deals, null, 2) }] };
    },
    idFields: ['leadId'],
    outputFields: ['id'],
    idMapping: { leadId: 'lead', id: 'deal' },
  },
];

export const CONTRACT_TOOLS: MCPToolConfig[] = [
  {
    name: 'generate_contract',
    description: 'Generate a contract for a deal',
    category: 'mutation',
    schema: {
      dealId: z.string().describe('Deal ID'),
      template: z.string().optional().describe('Contract template text'),
    },
    executor: async (args: any) => {
      return contractService.createContract(args);
    },
    mcpHandler: async (args: any) => {
      const contract = await contractService.createContract(args);
      return { content: [{ type: 'text', text: JSON.stringify(contract, null, 2) }] };
    },
    idFields: ['dealId'],
    outputFields: ['id'],
    idMapping: { dealId: 'deal', id: 'contract' },
  },
  {
    name: 'get_contract_status',
    description: 'Get the status of a contract',
    schema: {
      contractId: z.string().describe('Contract ID'),
    },
    executor: async (args: any) => {
      return contractService.getContractStatus(args.contractId);
    },
    mcpHandler: async (args: any) => {
      const contract = await contractService.getContractStatus(args.contractId);
      return { content: [{ type: 'text', text: JSON.stringify(contract, null, 2) }] };
    },
    idFields: ['contractId'],
    outputFields: ['id'],
    idMapping: { contractId: 'contract', id: 'contract' },
  },
  {
    name: 'list_contracts',
    description: 'List contracts with optional filters',
    schema: {
      status: z.enum(['DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELLED']).optional().describe('Filter by status'),
      dealId: z.string().optional().describe('Filter by deal ID'),
    },
    executor: async (args: any) => {
      return contractService.listContracts(args);
    },
    mcpHandler: async (args: any) => {
      const contracts = await contractService.listContracts(args);
      return { content: [{ type: 'text', text: JSON.stringify(contracts, null, 2) }] };
    },
    outputFields: ['id'],
    idMapping: { id: 'contract' },
  },
];

export const ALL_TOOLS = [...LEAD_TOOLS, ...DEAL_TOOLS, ...CONTRACT_TOOLS];
