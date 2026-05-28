export interface Settings {
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  category?: 'search' | 'create' | 'mutation' | 'read';
  idFields?: string[];
  outputFields?: string[];
  idMapping?: Record<string, string>;
  nameFields?: string[];
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}
