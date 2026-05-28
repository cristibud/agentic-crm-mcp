import type { ExecutionPlan } from './Planning.ts';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: string;
  extractedIds?: Record<string, string>;
  usedIds?: Record<string, string>;
  extractedIdsWithTypes?: Record<string, { value: string; entityType?: string }>;
}

export interface ExecutionTrace {
  stepOrder: number;
  toolName: string;
  inputIds: Record<string, string>;
  outputIds: Record<string, string>;
  result: unknown;
  error?: string;
  metadata?: {
    idFieldsRequired: string[];
    idFieldsExtracted: string[];
    semanticMappings?: Record<string, string>;
    extractedIdTypes?: Record<string, string>;
  };
}

export interface OrchestrationResult {
  plan: ExecutionPlan;
  executionResults: ToolResult[];
  executionTrace: ExecutionTrace[];
  finalResponse: string;
  messages: ChatCompletionMessageParam[];
  pendingPlanState?: PendingPlanState;
}

export interface PendingPlanState {
  plan: ExecutionPlan;
  missingParams: Array<{
    name: string;
    type?: string;
    description?: string;
  }>;
  toolName: string;
}
