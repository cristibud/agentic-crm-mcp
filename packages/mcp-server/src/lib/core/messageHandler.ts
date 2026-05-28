import { type Response } from 'express';
import { type ChatCompletionMessageParam } from 'openai/resources/chat';
import { orchestrateTools, extractAndCompletePlan, type PendingPlanState } from '../orchestration/orchestrator.js';
import { handleUserMessage, executeToolsAndRespond } from './llmHandler.js';
import { contextMemoryManager } from '../memory/contextMemory.js';
import { logger } from '../logger.js';
import type { ToolDefinition, Settings } from '../types/types.js';
import { type BaselineConfig, DEFAULT_BASELINE_CONFIG } from '../types/BaselineConfig.js';

interface MessageDeps {
  tools: ToolDefinition[];
  executors: Record<string, (args: any) => Promise<any>>;
  conversationHistories: Map<string, ChatCompletionMessageParam[]>;
  pendingPlanStates: Map<string, PendingPlanState>;
  settings: Settings;
  baselineConfig?: BaselineConfig;
}

function detectToolSwitch(message: string, pendingState: PendingPlanState, tools: ToolDefinition[]): boolean {
  const pendingTool = tools.find(t => t.name === pendingState.toolName);
  const pendingEntityTypes = new Set(Object.values(pendingTool?.idMapping || {}));
  const otherEntityTypes = new Set<string>();
  for (const tool of tools) {
    if (tool.name === pendingState.toolName) continue;
    for (const entityType of Object.values(tool.idMapping || {})) {
      if (!pendingEntityTypes.has(entityType)) otherEntityTypes.add(entityType);
    }
  }
  const messageLower = message.toLowerCase();
  return [...otherEntityTypes].some(entityType => messageLower.includes(entityType));
}

async function handlePendingPlan(
  message: string,
  sessionId: string,
  pendingState: PendingPlanState,
  deps: MessageDeps,
  res: Response
): Promise<boolean> {
  const { tools, executors, conversationHistories, pendingPlanStates, settings, baselineConfig = DEFAULT_BASELINE_CONFIG } = deps;
  const conversationHistory = conversationHistories.get(sessionId) || [];

  const contextMemory = contextMemoryManager.getSession(sessionId) || undefined;
  const extractionResult = extractAndCompletePlan(message, pendingState, contextMemory, tools);
  const { completedPlan, extractedParams, missingParams } = extractionResult;

  conversationHistory.push({ role: 'user', content: message });
  contextMemoryManager.addMessage(sessionId, 'user', message);

  if (completedPlan) {
    logger.info({ extractedParams: Object.keys(extractedParams), tool: pendingState.toolName }, 'all parameters extracted, resuming plan');
    const orchestrationResult = await orchestrateTools(message, tools, executors, conversationHistory, settings, completedPlan, sessionId, baselineConfig);
    pendingPlanStates.delete(sessionId);
    if (orchestrationResult.pendingPlanState) pendingPlanStates.set(sessionId, orchestrationResult.pendingPlanState);
    conversationHistories.set(sessionId, orchestrationResult.messages);
    contextMemoryManager.addMessage(sessionId, 'assistant', orchestrationResult.finalResponse);
    const executedTools = orchestrationResult.executionResults.filter(r => !r.error).map(r => ({ name: r.toolName, result: r.result }));
    res.json({ response: orchestrationResult.finalResponse, plan: orchestrationResult.plan, executionTrace: orchestrationResult.executionTrace, toolCalls: executedTools, sessionId });
    return true;
  }

  const extractedList = Object.entries(extractedParams).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const stillMissingList = missingParams.map(p => `- **${p.name}**${p.type ? ` (${p.type})` : ''}${p.description ? `: ${p.description}` : ''}`).join('\n');
  const feedbackMessage = extractedList
    ? `I found some parameters from your message:\n${extractedList}\n\nBut I still need:\n${stillMissingList}\n\nPlease provide the missing parameters.`
    : `I still need:\n${stillMissingList}\n\nPlease provide the missing parameters.`;

  logger.info({ foundParams: Object.keys(extractedParams), stillMissing: missingParams.map(p => p.name) }, 'partial parameters found, awaiting remaining');
  pendingPlanStates.set(sessionId, { ...pendingState, missingParams });
  res.json({ response: feedbackMessage, sessionId, partialExtraction: { extracted: extractedParams, missing: missingParams.map(p => p.name) } });
  return true;
}

async function fallbackToLlm(
  message: string,
  sessionId: string,
  deps: MessageDeps,
  res: Response
): Promise<void> {
  const { tools, executors, conversationHistories, settings } = deps;
  const conversationHistory = conversationHistories.get(sessionId) || [];

  contextMemoryManager.addMessage(sessionId, 'user', message);

  const { response: textResponse, toolCalls, messages: updatedHistory } = await handleUserMessage(message, tools, conversationHistory, settings);
  conversationHistories.set(sessionId, updatedHistory);

  let finalResponse = textResponse;
  const executedTools: any[] = [];

  if (toolCalls.length > 0) {
    const { response, messages: finalHistory, executedResults } = await executeToolsAndRespond(toolCalls, executors, updatedHistory, settings);
    finalResponse = response;
    conversationHistories.set(sessionId, finalHistory);
    executedTools.push(...toolCalls.map(tc => ({ name: tc.name, arguments: tc.arguments })));

    for (const er of executedResults) {
      const toolDef = tools.find(t => t.name === er.name);
      if (er.error) {
        contextMemoryManager.addFailedExecution(sessionId, er.name, {}, er.error);
      } else {
        contextMemoryManager.addExecutionResult(sessionId, er.name, er.result, toolDef);
      }
    }
  }

  contextMemoryManager.addMessage(sessionId, 'assistant', finalResponse);
  res.json({ response: finalResponse, toolCalls: executedTools, sessionId });
}

export async function handleMessage(
  message: string,
  sessionId: string,
  deps: MessageDeps,
  res: Response
): Promise<void> {
  const { tools, executors, conversationHistories, pendingPlanStates, settings, baselineConfig = DEFAULT_BASELINE_CONFIG } = deps;

  if (!conversationHistories.has(sessionId)) conversationHistories.set(sessionId, []);

  try {
    const pendingState = pendingPlanStates.get(sessionId);

    if (pendingState) {
      if (detectToolSwitch(message, pendingState, tools)) {
        logger.info({ prevTool: pendingState.toolName }, 'tool switch detected, discarding pending plan');
        pendingPlanStates.delete(sessionId);
      } else {
        logger.info({ toolName: pendingState.toolName, missingParams: pendingState.missingParams.map(p => p.name) }, 'resuming incomplete plan');
        const handled = await handlePendingPlan(message, sessionId, pendingState, deps, res);
        if (handled) return;
      }
    }

    const conversationHistory = conversationHistories.get(sessionId) || [];
    const orchestrationResult = await orchestrateTools(message, tools, executors, conversationHistory, settings, undefined, sessionId, baselineConfig);
    if (orchestrationResult.pendingPlanState) pendingPlanStates.set(sessionId, orchestrationResult.pendingPlanState);
    conversationHistories.set(sessionId, orchestrationResult.messages);
    contextMemoryManager.addMessage(sessionId, 'assistant', orchestrationResult.finalResponse);
    const executedTools = orchestrationResult.executionResults.filter(r => !r.error).map(r => ({ name: r.toolName, result: r.result }));
    res.json({ response: orchestrationResult.finalResponse, plan: orchestrationResult.plan, executionTrace: orchestrationResult.executionTrace, toolCalls: executedTools, sessionId });
  } catch (error) {
    logger.warn({ error }, 'orchestration failed, falling back to direct LLM handling');
    await fallbackToLlm(message, sessionId, deps, res);
  }
}
