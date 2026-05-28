import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer, getToolRegistry } from './mcpServer.js';
import { handleMessage } from './lib/core/messageHandler.js';
import { contextMemoryManager } from './lib/memory/contextMemory.js';
import { settingsClient } from './lib/apiClient.js';
import { logger } from './lib/logger.js';
import type { PendingPlanState } from './lib/orchestration/orchestrator.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { FULL_BASELINE_CONFIG, DEFAULT_BASELINE_CONFIG, getBaselineConfigFromEnv } from './lib/types/BaselineConfig.js';

const app: Express = express();
const PORT = Number(process.env.MCP_PORT) || 3002;

app.use(cors());
app.use(express.json());

const mcpServer = createMcpServer();
const toolRegistry = getToolRegistry();

const transports = new Map<string, SSEServerTransport>();
const conversationHistories = new Map<string, ChatCompletionMessageParam[]>();
const pendingPlanStates = new Map<string, PendingPlanState>();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/sse', async (_req, res) => {
  logger.info('New SSE connection');
  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => {
    transports.delete(transport.sessionId);
    conversationHistories.delete(transport.sessionId);
    pendingPlanStates.delete(transport.sessionId);
    logger.info({ sessionId: transport.sessionId }, 'SSE connection closed');
  });
  await mcpServer.connect(transport);
});

app.post('/message', async (req, res) => {
  try {
    const sessionId = req.query['sessionId'] as string;
    const transport = transports.get(sessionId);

    if (transport) {
      await transport.handlePostMessage(req, res);
      return;
    }

    const { message } = req.body;
    if (!message) { res.status(400).json({ error: 'Message is required' }); return; }
    if (!sessionId) { res.status(400).json({ error: 'Session ID is required' }); return; }

    const settings = await settingsClient.getSettings();
    const isBaselineRequest = req.query['baseline'] === 'true';
    const envConfig = getBaselineConfigFromEnv();
    const baselineConfig = isBaselineRequest ? FULL_BASELINE_CONFIG
      : (envConfig.disablePlanValidation || envConfig.disablePlanRepair || envConfig.disableExecutionRetry)
        ? envConfig
        : DEFAULT_BASELINE_CONFIG;

    logger.info({ model: settings.llmModel, hasApiKey: !!settings.llmApiKey, sessionId, toolsCount: toolRegistry.tools.length, baselineConfig }, 'Processing message');

    await handleMessage(message, sessionId, {
      tools: toolRegistry.tools,
      executors: toolRegistry.executors,
      conversationHistories,
      pendingPlanStates,
      settings,
      baselineConfig,
    }, res);
  } catch (error) {
    logger.error({ error }, 'Message processing error');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Processing error' });
  }
});

app.get('/tools', (_req, res) => {
  res.json({ tools: toolRegistry.tools });
});

app.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  contextMemoryManager.clearSession(sessionId);
  conversationHistories.delete(sessionId);
  pendingPlanStates.delete(sessionId);
  logger.info({ sessionId }, 'session reset');
  res.json({ status: 'ok', sessionId });
});

app.post('/restart', (_req, res) => {
  settingsClient.clearCache();
  logger.info('settings cache cleared');
  res.json({ status: 'ok', message: 'Settings cache cleared, will reload on next request' });
});

app.listen(PORT, () => {
  logger.info(`MCP server running on port ${PORT}`);
  logger.info('Endpoints: /health, /sse, /message, /tools, /session/:id, /restart');
  logger.info(`Available tools: ${toolRegistry.tools.map(t => t.name).join(', ')}`);
});

export default app;
