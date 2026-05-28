import { logger } from '../logger.js';
import type { ToolDefinition } from '../types/types.js';

export function extractIds(
  obj: unknown,
  toolName: string,
  tool: ToolDefinition | undefined
): Record<string, { value: string; entityType?: string }> {
  const ids: Record<string, { value: string; entityType?: string }> = {};

  if (!obj || typeof obj !== 'object' || !tool?.outputFields) return ids;

  for (const field of tool.outputFields) {
    if (field in (obj as Record<string, unknown>)) {
      const value = (obj as Record<string, any>)[field];
      if (typeof value === 'string') {
        const entityType = tool.idMapping?.[field];
        ids[field] = { value, entityType };
        ids[`${toolName}.${field}`] = { value, entityType };
      }
    }
  }

  if (Array.isArray(obj) && obj.length > 0) {
    const firstItem = obj[0];
    if (typeof firstItem === 'object') {
      const arrayIds = extractIds(firstItem, toolName, tool);
      Object.assign(ids, arrayIds);
    }
  }

  return ids;
}

export function flattenIds(semanticIds: Record<string, { value: string; entityType?: string }>): Record<string, string> {
  const flattened: Record<string, string> = {};
  for (const [key, data] of Object.entries(semanticIds)) {
    flattened[key] = data.value;
  }
  return flattened;
}

export function normalizeToolInputs(
  inputs: Record<string, unknown>,
  tool: ToolDefinition | undefined
): Record<string, unknown> {
  if (!tool?.parameters?.properties) {
    logger.warn({ inputs, toolName: tool?.name }, 'no parameter definition found, returning inputs as-is');
    return inputs;
  }

  const normalized: Record<string, unknown> = {};
  const toolName = tool.name;

  logger.debug({ toolName, inputKeys: Object.keys(inputs) }, 'normalizing tool inputs');

  for (const [paramName, paramValue] of Object.entries(inputs)) {
    if (paramValue === null || paramValue === undefined) {
      logger.debug({ toolName, paramName }, 'skipping null/undefined parameter');
      continue;
    }
    if (typeof paramValue === 'string' && paramValue.trim() === '') {
      logger.debug({ toolName, paramName }, 'skipping empty string parameter');
      continue;
    }

    const paramDef = tool.parameters.properties[paramName] as any;

    if (!paramDef) {
      logger.warn({ toolName, paramName }, 'parameter not declared in tool definition, keeping as-is');
      normalized[paramName] = paramValue;
      continue;
    }

    // Convert string to number when the parameter type requires it
    if (paramDef?.type === 'number' && typeof paramValue === 'string') {
      let cleanedValue = paramValue.trim();
      if (cleanedValue.endsWith('%')) {
        cleanedValue = cleanedValue.slice(0, -1).trim();
      }
      const numValue = Number(cleanedValue);
      if (!isNaN(numValue)) {
        normalized[paramName] = numValue;
        logger.info({ toolName, paramName, original: paramValue, converted: numValue }, 'converted string to number');
      } else {
        logger.warn({ toolName, paramName, original: paramValue }, 'could not convert to number, omitting parameter');
      }
    }
    // Case-insensitive enum matching
    else if (paramDef?.enum && typeof paramValue === 'string') {
      const stringValue = String(paramValue).trim();
      const match = paramDef.enum.find((e: string) => e.toUpperCase() === stringValue.toUpperCase());
      if (match) {
        normalized[paramName] = match;
        if (match !== paramValue) {
          logger.info({ toolName, paramName, original: paramValue, matched: match }, 'normalized enum value');
        }
      } else {
        logger.warn({ toolName, paramName, original: paramValue, validEnums: paramDef.enum }, 'invalid enum value, omitting');
      }
    }
    else {
      normalized[paramName] = paramValue;
    }
  }

  logger.debug({ toolName, outputKeys: Object.keys(normalized) }, 'tool inputs normalized');

  return normalized;
}

export function mapIdsForTool(
  toolName: string,
  tool: ToolDefinition | undefined,
  availableIds: Record<string, { value: string; entityType?: string }>
): Record<string, string> {
  const mappedIds: Record<string, string> = {};

  if (!tool?.idFields || tool.idFields.length === 0) {
    logger.debug({ toolName }, 'no ID parameters declared for tool');
    return mappedIds;
  }

  logger.debug({ toolName, declaredIdFields: tool.idFields }, 'mapping ID parameters');

  for (const param of tool.idFields) {
    const requiredEntityType = tool.idMapping?.[param];

    // Strategy 1: exact field name match
    if (availableIds[param]) {
      mappedIds[param] = availableIds[param].value;
      logger.debug({ param, value: availableIds[param].value }, 'mapped ID via exact field name');
      continue;
    }

    // Strategy 2: semantic entity type match
    if (requiredEntityType) {
      for (const [idField, idData] of Object.entries(availableIds)) {
        if (idData.entityType === requiredEntityType) {
          mappedIds[param] = idData.value;
          logger.debug({ param, idField, entityType: requiredEntityType, value: idData.value }, 'mapped ID via entity type');
          break;
        }
      }
    }

    if (!mappedIds[param]) {
      logger.warn(
        { param, requiredEntityType, availableIds: Object.keys(availableIds) },
        `cannot map required ID parameter: ${param} (entity type: ${requiredEntityType})`
      );
    }
  }

  return mappedIds;
}
