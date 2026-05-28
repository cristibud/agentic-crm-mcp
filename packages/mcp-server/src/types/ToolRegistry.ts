import type { ToolDefinition } from '../lib/types/types.js';

export interface ToolRegistry {
  tools: ToolDefinition[];
  executors: Record<string, (args: any) => Promise<any>>;
}
