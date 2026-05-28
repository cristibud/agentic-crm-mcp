export interface ConversationMessage {
  timestamp: number;
  role: 'user' | 'assistant';
  content: string;
  entities?: Record<string, string>;
}

export interface ActionHistoryEntry {
  timestamp: number;
  action: string;
  toolName: string;
  description: string;
  inputParams?: Record<string, any>;
  outputIds?: Record<string, string>;
  resultSummary?: string;
  error?: string;
  failed?: boolean;
}

export interface ContextMemory {
  sessionId: string;
  messages: ConversationMessage[];
  extractedContext: Record<string, any>;
  lastReferencedEntities: Record<string, { value: string; entityType: string }>;
  actionHistory: ActionHistoryEntry[];
  entityIndex: Record<string, Record<string, string>>;
}
