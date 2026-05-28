import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDefinition } from './lib/types/types.js';
import { ALL_TOOLS, type MCPToolConfig } from './tools/definitions.js';
import { leadService } from './services/leadService.js';
import { dealService } from './services/dealService.js';
import { contractService } from './services/contractService.js';
import { convertZodSchemaToParameters } from './lib/core/zodSchemaConverter.js';

interface ToolRegistry {
  tools: ToolDefinition[];
  executors: Record<string, (args: any) => Promise<any>>;
}

const toolRegistry: ToolRegistry = { tools: [], executors: {} };

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'crm-mcp', version: '1.0.0' });

  // Register all tools
  for (const toolConfig of ALL_TOOLS) {
    // Register with MCP server
    server.tool(toolConfig.name, toolConfig.schema, toolConfig.mcpHandler || toolConfig.executor);

    // Register in tool registry for orchestration
    const parameters = convertZodSchemaToParameters(toolConfig.schema);
    const toolDef: ToolDefinition = {
      name: toolConfig.name,
      description: toolConfig.description,
      parameters,
      category: toolConfig.category,
      idFields: toolConfig.idFields,
      outputFields: toolConfig.outputFields,
      idMapping: toolConfig.idMapping,
    };

    toolRegistry.tools.push(toolDef);
    toolRegistry.executors[toolConfig.name] = toolConfig.executor;
  }

  // Register resources
  server.resource('leads://all', 'leads://all', async () => {
    const leads = await leadService.getAllLeads(100);
    return {
      contents: [
        {
          uri: 'leads://all',
          mimeType: 'application/json',
          text: JSON.stringify(leads, null, 2),
        },
      ],
    };
  });

  server.resource('deals://pipeline', 'deals://pipeline', async () => {
    const { deals, summary } = await dealService.getPipeline({});
    return {
      contents: [
        {
          uri: 'deals://pipeline',
          mimeType: 'application/json',
          text: JSON.stringify({ deals, summary }, null, 2),
        },
      ],
    };
  });

  server.resource('contracts://recent', 'contracts://recent', async () => {
    const contracts = await contractService.getRecentContracts(20);
    return {
      contents: [
        {
          uri: 'contracts://recent',
          mimeType: 'application/json',
          text: JSON.stringify(contracts, null, 2),
        },
      ],
    };
  });

  // Register prompts
  server.prompt('sales_report', {}, () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Generate a comprehensive sales report with pipeline summary, recent deals, and metrics.',
          },
        },
      ],
    };
  });

  server.prompt(
    'lead_qualification',
    { leadId: z.string().describe('Lead ID to analyze') },
    async ({ leadId }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the lead and provide qualification assessment with quality score and next steps.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'contract_draft',
    { dealId: z.string().describe('Deal ID for contract draft') },
    async ({ dealId }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Draft a professional service contract for the deal with terms and conditions.`,
            },
          },
        ],
      };
    },
  );

  return server;
}

export function getToolRegistry() {
  return toolRegistry;
}

// Import z for prompts
import { z } from 'zod';
