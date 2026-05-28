import { logger } from '../logger.js';
import { extractEntities, generateActionDescription, formatContextSummary } from './contextMemoryHelpers.js';
import type { ConversationMessage, ActionHistoryEntry, ContextMemory } from '../../types/ContextMemory.js';
import type { ToolDefinition } from '../types/types.js';
import * as fs from 'fs';
import * as path from 'path';

export { extractEntities };
export type { ConversationMessage, ActionHistoryEntry, ContextMemory };

export class ContextMemoryManager {
  private memory: Map<string, ContextMemory> = new Map();
  private maxMessages = 20;
  private maxActionHistory = 20;
  private logsDir = process.env.CONTEXT_LOGS_DIR || './logs/context-memory';

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private writeLog(sessionId: string, entry: Record<string, any>): void {
    try {
      this.ensureLogsDir();
      const logFile = path.join(this.logsDir, `${sessionId}.jsonl`);
      const logLine = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (err) {
      logger.warn({ sessionId, error: String(err) }, 'failed to write context memory log');
    }
  }

  createSession(sessionId: string): ContextMemory {
    const contextMemory: ContextMemory = {
      sessionId,
      messages: [],
      extractedContext: {},
      lastReferencedEntities: {},
      actionHistory: [],
      entityIndex: {},
    };
    this.memory.set(sessionId, contextMemory);
    this.writeLog(sessionId, { event: 'session_created', sessionId });
    logger.info({ sessionId }, 'context memory session created');
    return contextMemory;
  }

  getSession(sessionId: string): ContextMemory | null {
    return this.memory.get(sessionId) || null;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): ContextMemory {
    let contextMemory = this.memory.get(sessionId);
    if (!contextMemory) {
      contextMemory = this.createSession(sessionId);
    }

    const entities = extractEntities(content);

    contextMemory.messages.push({
      timestamp: Date.now(),
      role,
      content,
      entities,
    });

    if (contextMemory.messages.length > this.maxMessages) {
      contextMemory.messages = contextMemory.messages.slice(-this.maxMessages);
    }

    // Update global extracted context
    if (role === 'user' && entities) {
      if (entities.lastMentionedName) contextMemory.extractedContext.lastMentionedEntity = entities.lastMentionedName;
      if (entities.email) contextMemory.extractedContext.lastEmail = entities.email;
      if (entities.amount) contextMemory.extractedContext.lastAmount = entities.amount;
      if (entities.percentage) contextMemory.extractedContext.lastPercentage = entities.percentage;
      if (entities.phone) contextMemory.extractedContext.lastPhone = entities.phone;
    }

    this.writeLog(sessionId, { event: 'message_added', role, contentPreview: content.substring(0, 100), entities });
    logger.debug(
      { sessionId, messageCount: contextMemory.messages.length, extractedContext: contextMemory.extractedContext },
      'Message added to context memory'
    );

    return contextMemory;
  }

  getContextSummary(sessionId: string, tools?: ToolDefinition[]): string {
    const contextMemory = this.memory.get(sessionId);
    if (!contextMemory || contextMemory.messages.length === 0) {
      return '';
    }

    const conversationHistory = contextMemory.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 100)}...`)
      .join('\n');

    const successfulActions = contextMemory.actionHistory
      .filter(e => !e.failed)
      .slice(-10)
      .map((entry, idx) => {
        const ids = entry.outputIds ? ` [${Object.entries(entry.outputIds).map(([k, v]) => `${k}:${v}`).join(', ')}]` : '';
        return `${idx + 1}. ${entry.description}${ids}`;
      })
      .join('\n');

    const failedAttempts = contextMemory.actionHistory
      .filter(e => e.failed)
      .slice(-5)
      .map((entry, idx) => {
        const params = entry.inputParams
          ? ` (params: ${Object.entries(entry.inputParams).map(([k, v]) => `${k}=${v}`).join(', ')})`
          : '';
        return `${idx + 1}. ${entry.toolName}${params} → ERROR: ${entry.error}`;
      })
      .join('\n');

    const extractedEntities = Object.entries(contextMemory.extractedContext)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    const createdEntities = Object.entries(contextMemory.lastReferencedEntities)
      .map(([key, data]) => {
        if (typeof data === 'object' && data.value && data.entityType) {
          return `- ${key}: ${data.value} [${data.entityType}]`;
        } else if (typeof data === 'string') {
          return `- ${key}: ${data}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');

    // Build entity → ID field hints dynamically from registered tool definitions
    let entityFieldHints: string | undefined;
    if (tools && tools.length > 0) {
      const entityMap = new Map<string, string>(); // entityType → idFieldName
      for (const tool of tools) {
        for (const [field, entityType] of Object.entries(tool.idMapping || {})) {
          if (!entityMap.has(entityType)) entityMap.set(entityType, field);
        }
      }
      if (entityMap.size > 0) {
        entityFieldHints = [...entityMap.entries()]
          .map(([entityType, field]) => `   - For ${entityType} operations: use \`${field}\``)
          .join('\n');
      }
    }

    // Format entityIndex: entityType → name → id
    const entityIndexEntries = Object.entries(contextMemory.entityIndex || {});
    const entityIndexSummary = entityIndexEntries.length > 0
      ? entityIndexEntries
        .map(([entityType, nameMap]) => {
          const entries = Object.entries(nameMap)
            .map(([name, id]) => `    • "${name}" → ${id}`)
            .join('\n');
          return `  ${entityType}:\n${entries}`;
        })
        .join('\n')
      : '(no entities indexed yet)';

    return formatContextSummary(conversationHistory, successfulActions, extractedEntities, createdEntities, failedAttempts, entityFieldHints, entityIndexSummary);
  }

  clearSession(sessionId: string): void {
    this.memory.delete(sessionId);
    this.writeLog(sessionId, { event: 'session_cleared', sessionId });
    logger.info({ sessionId }, 'context memory session cleared');
  }

  private extractEntityName(
    obj: Record<string, any>,
    nameFields?: string[]
  ): string | null {
    const fieldsToCheck = [
      ...(nameFields || []),
      'name', 'title', 'fullName', 'fullname', 'label',
    ];
    for (const field of fieldsToCheck) {
      if (obj[field] && typeof obj[field] === 'string') return obj[field].trim();
    }
    // firstName + lastName combo
    if (obj.firstName && obj.lastName) return `${obj.firstName} ${obj.lastName}`.trim();
    return null;
  }

  private indexEntityResult(
    contextMemory: ContextMemory,
    entityType: string,
    idValue: string,
    resultObj: Record<string, any>,
    nameFields?: string[],
    sessionId?: string,
    toolName?: string
  ): void {
    const entityName = this.extractEntityName(resultObj, nameFields);
    if (!entityName) return;
    if (!contextMemory.entityIndex[entityType]) contextMemory.entityIndex[entityType] = {};
    contextMemory.entityIndex[entityType][entityName] = idValue;
    if (sessionId) {
      this.writeLog(sessionId, { event: 'entity_indexed', toolName, entityType, entityName, id: idValue });
      logger.debug({ entityType, entityName, id: idValue }, 'entity indexed by name');
    }
  }

  addExecutionResult(
    sessionId: string,
    toolName: string,
    result: unknown,
    toolDef?: { outputFields?: string[]; idMapping?: Record<string, string>; nameFields?: string[] }
  ): void {
    let contextMemory = this.memory.get(sessionId);
    if (!contextMemory) {
      contextMemory = this.createSession(sessionId);
    }

    if (!result || typeof result !== 'object' || !toolDef?.outputFields) {
      return;
    }

    const resultObj = result as Record<string, any>;
    const extractedIds: Record<string, string> = {};

    // Extract IDs from a single result object and populate entityIndex
    if (!Array.isArray(result)) {
      for (const field of toolDef.outputFields) {
        const value = resultObj[field];
        if (value) {
          const entityType = toolDef.idMapping?.[field] || field.toLowerCase().replace('id', '').replace('Id', '');
          contextMemory.lastReferencedEntities[field] = { value, entityType };
          const lastKeyName = `last${entityType?.charAt(0).toUpperCase() || ''}${entityType?.slice(1) || field}`;
          contextMemory.lastReferencedEntities[lastKeyName] = { value, entityType };
          extractedIds[field] = value;
          this.writeLog(sessionId, { event: 'id_extracted', toolName, field, value, entityType, lastKeyName });
          logger.info(
            { sessionId, tool: toolName, field, value, entityType, lastKeyName },
            `Saved execution result ID to context memory with keys: "${field}" and "${lastKeyName}"`
          );
          // Index the entity by name so future "update John's X" can resolve the ID
          this.indexEntityResult(contextMemory, entityType, value, resultObj, toolDef.nameFields, sessionId, toolName);
        }
      }
    }

    // Handle array results — index ALL items, use first item for lastReferencedEntities
    if (Array.isArray(result) && result.length > 0) {
      const firstItem = result[0];
      if (typeof firstItem === 'object') {
        for (const field of toolDef.outputFields) {
          const value = firstItem[field];
          if (value) {
            const entityType = toolDef.idMapping?.[field] || field.toLowerCase().replace('id', '').replace('Id', '');
            contextMemory.lastReferencedEntities[field] = { value, entityType };
            extractedIds[field] = value;
          }
        }
      }
      // Index every item in the array into entityIndex
      for (const item of result) {
        if (!item || typeof item !== 'object') continue;
        const itemObj = item as Record<string, any>;
        for (const field of toolDef.outputFields) {
          const idValue = itemObj[field];
          if (!idValue) continue;
          const entityType = toolDef.idMapping?.[field] || field.toLowerCase().replace('id', '').replace('Id', '');
          this.indexEntityResult(contextMemory, entityType, idValue, itemObj, toolDef.nameFields, sessionId, toolName);
        }
      }
    }

    // Generate action type generically (no hardcoded mapping)
    const resultCount = Array.isArray(result) ? result.length : 1;
    const description = generateActionDescription(toolName, result, resultCount);
    const actionType = toolName; // Use tool name directly as action type

    this.addAction(sessionId, actionType, toolName, description, extractedIds, resultCount, resultObj);
  }

  addFailedExecution(
    sessionId: string,
    toolName: string,
    inputParams: Record<string, any>,
    error: string
  ): void {
    let contextMemory = this.memory.get(sessionId);
    if (!contextMemory) {
      contextMemory = this.createSession(sessionId);
    }

    const description = `Failed to execute ${toolName}: ${error}`;
    const historyEntry: ActionHistoryEntry = {
      timestamp: Date.now(),
      action: toolName,
      toolName,
      description,
      inputParams,
      failed: true,
      error,
    };

    contextMemory.actionHistory.push(historyEntry);

    if (contextMemory.actionHistory.length > this.maxActionHistory) {
      contextMemory.actionHistory = contextMemory.actionHistory.slice(-this.maxActionHistory);
    }

    this.writeLog(sessionId, { event: 'execution_failed', toolName, inputParams, error });
    logger.warn(
      { sessionId, toolName, error },
      'Failed execution recorded in context memory'
    );
  }

  logEvent(sessionId: string, entry: Record<string, any>): void {
    this.writeLog(sessionId, entry);
  }

  addAction(
    sessionId: string,
    action: string,
    toolName: string,
    description: string,
    outputIds?: Record<string, string>,
    resultCount?: number,
    inputParams?: Record<string, any>
  ): void {
    let contextMemory = this.memory.get(sessionId);
    if (!contextMemory) {
      contextMemory = this.createSession(sessionId);
    }

    const historyEntry: ActionHistoryEntry = {
      timestamp: Date.now(),
      action,
      toolName,
      description,
      inputParams,
      outputIds,
      resultSummary: resultCount ? `${resultCount} result${resultCount !== 1 ? 's' : ''}` : undefined,
    };

    contextMemory.actionHistory.push(historyEntry);

    if (contextMemory.actionHistory.length > this.maxActionHistory) {
      contextMemory.actionHistory = contextMemory.actionHistory.slice(-this.maxActionHistory);
    }

    this.writeLog(sessionId, { event: 'action_added', action, toolName, description, outputIds, resultCount });
    logger.debug(
      { sessionId, action, tool: toolName },
      'Action added to history'
    );
  }

  logPlanCreated(
    sessionId: string,
    attempt: number,
    nSteps: number,
    toolsInPlan: string[],
    reasoning?: string
  ): void {
    this.writeLog(sessionId, {
      event: 'plan_created',
      attempt,
      isReplan: attempt > 0,
      nSteps,
      toolsInPlan,
      reasoning: reasoning ? reasoning.substring(0, 200) : undefined,
    });
  }

  logReplanMessage(
    sessionId: string,
    attempt: number,
    errorContext: string,
    successContext: string,
    replanMessage: string
  ): void {
    this.writeLog(sessionId, {
      event: 'replan_message_built',
      attempt,
      hasSuccessContext: !!successContext,
      hasErrorContext: !!errorContext,
      errorContextPreview: errorContext ? errorContext.substring(0, 300) : '',
      successContextPreview: successContext ? successContext.substring(0, 200) : '',
      replanMessagePreview: replanMessage ? replanMessage.substring(0, 500) : '',
    });
  }
}

export const contextMemoryManager = new ContextMemoryManager();
