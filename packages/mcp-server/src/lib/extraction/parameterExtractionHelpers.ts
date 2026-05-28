import { logger } from '../logger.js';
import type { ToolDefinition } from '../types/types.js';
import type { PendingPlanState } from '../../types/Planning.js';
import type { ContextMemory } from '../../types/ContextMemory.js';

export function resolveValue(
  raw: string,
  paramName: string,
  paramDef: any,
  isValueTypeCompatible: (v: string, p: string, d: any) => boolean
): string | null {
  if (!raw) return null;
  if (paramDef?.enum) {
    const tokens = raw.split(/\s+/);
    for (const token of tokens) {
      const match = (paramDef.enum as string[]).find(e => e.toLowerCase() === token.toLowerCase());
      if (match) return match;
    }
    return null;
  }
  return isValueTypeCompatible(raw, paramName, paramDef) ? raw : null;
}

export function extractFromContextMemory(
  missingParamNames: string[],
  contextMemory: ContextMemory | undefined,
  toolDefs: ToolDefinition[] | undefined,
  pendingState: PendingPlanState
): Record<string, string> {
  const extracted: Record<string, string> = {};

  // 1a: extracted context (lastEmail, lastAmount, etc.)
  if (contextMemory?.extractedContext) {
    for (const paramName of missingParamNames) {
      if (extracted[paramName]) continue;
      const paramBase = paramName.toLowerCase().replace('id', '');
      const keysToTry = [`last${paramName}`, paramName, `last${paramBase}`, paramBase];
      for (const contextKey of keysToTry) {
        const contextValue = contextMemory.extractedContext[contextKey];
        if (contextValue && typeof contextValue === 'string') {
          extracted[paramName] = contextValue;
          logger.debug({ paramName, contextKey, source: 'contextMemory' }, 'parameter found in context memory');
          break;
        }
      }
    }
  }

  // 1b: last created entity IDs via idMapping
  if (contextMemory?.lastReferencedEntities && toolDefs) {
    const currentTool = toolDefs.find(t => t.name === pendingState.toolName);
    if (currentTool?.idMapping) {
      for (const paramName of missingParamNames) {
        if (extracted[paramName]) continue;
        const requiredEntityType = currentTool.idMapping[paramName];
        if (!requiredEntityType) continue;
        for (const [contextKey, entity] of Object.entries(contextMemory.lastReferencedEntities)) {
          if (typeof entity !== 'object' || !('value' in entity) || !('entityType' in entity)) continue;
          const entityType = (entity as any).entityType?.toLowerCase();
          if (entityType === requiredEntityType.toLowerCase()) {
            extracted[paramName] = (entity as any).value;
            logger.debug({ paramName, contextKey, entityType, value: (entity as any).value }, 'entity ID resolved via tool idMapping');
            break;
          }
        }
      }
    }
  }

  return extracted;
}

export function extractFromUserMessage(
  userMessage: string,
  missingParamNames: string[],
  toolDefs: ToolDefinition[] | undefined,
  pendingState: PendingPlanState,
  resolveFn: (raw: string, paramName: string, paramDef: any) => string | null
): Record<string, string> {
  const extracted: Record<string, string> = {};

  const getParamDef = (paramName: string) =>
    toolDefs?.find(t => t.name === pendingState.toolName)?.parameters.properties[paramName];

  // Pattern 1: explicit "key: value"
  if (Object.keys(extracted).length < missingParamNames.length) {
    const keyValuePattern = /(\w+)\s*:\s*([^,\n]+)/g;
    let match;
    while ((match = keyValuePattern.exec(userMessage)) !== null) {
      const key = match[1].toLowerCase().trim();
      const rawValue = match[2].trim();
      const paramName = missingParamNames.find(p => !extracted[p] && p.toLowerCase() === key);
      if (paramName) {
        const resolved = resolveFn(rawValue, paramName, getParamDef(paramName));
        if (resolved) extracted[paramName] = resolved;
      }
    }
  }

  // Pattern 2: "paramName <filler> value" (handles "is", "=", "e", "in")
  if (Object.keys(extracted).length < missingParamNames.length) {
    for (const paramName of missingParamNames) {
      if (extracted[paramName]) continue;
      const afterParamPattern = new RegExp(`\\b${paramName}\\b[^\\w]*([\\w\\s]+)`, 'i');
      const afterMatch = afterParamPattern.exec(userMessage);
      if (afterMatch) {
        const resolved = resolveFn(afterMatch[1].trim(), paramName, getParamDef(paramName));
        if (resolved) {
          extracted[paramName] = resolved;
          logger.debug({ paramName, raw: afterMatch[1], resolved }, 'extracted via param-name prefix pattern');
        }
      }
    }
  }

  // Pattern 3: token-by-token, scan ahead past filler tokens
  if (Object.keys(extracted).length < missingParamNames.length) {
    const tokens = userMessage.split(/[\s,]+/).filter(t => t.trim().length > 0);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].toLowerCase();
      const paramName = missingParamNames.find(p => !extracted[p] && p.toLowerCase() === token);
      if (!paramName) continue;
      for (let j = i + 1; j < tokens.length; j++) {
        const resolved = resolveFn(tokens[j], paramName, getParamDef(paramName));
        if (resolved) {
          extracted[paramName] = resolved;
          logger.debug({ paramName, token: tokens[j], resolved }, 'extracted via token scan');
          break;
        }
      }
    }
  }

  // Pattern 4: single missing param — scan tokens or whole message
  if (Object.keys(extracted).length === 0 && missingParamNames.length === 1) {
    const paramName = missingParamNames[0];
    const paramDef = getParamDef(paramName) as any;

    if (paramDef?.enum) {
      for (const token of userMessage.split(/\s+/)) {
        const match = (paramDef.enum as string[]).find((e: string) => e.toLowerCase() === token.toLowerCase());
        if (match) {
          extracted[paramName] = match;
          logger.debug({ paramName, token, match }, 'extracted enum value via token scan');
          break;
        }
      }
    }

    if (!extracted[paramName]) {
      const value = userMessage.trim();
      const skipPhrases = ['can ', 'please ', 'could ', 'yes ', 'sure ', 'ok ', 'okay '];
      const isFiller = skipPhrases.some(p => value.toLowerCase().startsWith(p));
      if (!isFiller && value.length > 1) {
        const resolved = resolveFn(value, paramName, paramDef);
        if (resolved) {
          extracted[paramName] = resolved;
          logger.debug({ paramName, value: resolved }, 'extracted from full message scan');
        }
      }
    }
  }

  return extracted;
}

export function extractFromContextFallback(
  remainingMissing: string[],
  contextMemory: ContextMemory | undefined
): Record<string, string> {
  const extracted: Record<string, string> = {};
  if (!contextMemory?.extractedContext) return extracted;

  for (const paramName of remainingMissing) {
    const paramBase = paramName.toLowerCase().replace('id', '');
    for (const [contextKey, contextValue] of Object.entries(contextMemory.extractedContext)) {
      if (!contextValue || typeof contextValue !== 'string') continue;
      const ck = contextKey.toLowerCase();
      if (ck === paramName.toLowerCase() || ck === paramBase || ck === `last${paramName}` || ck === `last${paramBase}`) {
        extracted[paramName] = contextValue;
        logger.debug({ paramName, contextKey }, 'parameter filled from context memory (fallback)');
        break;
      }
    }
  }
  return extracted;
}
