import { logger } from '../logger.js';
import type { ToolDefinition } from '../types/types.js';
import type { ExecutionPlan } from '../../types/Planning.js';
import type { ToolResult } from '../../types/ToolExecution.js';
import { detectMissingParameters } from '../validation/planValidator.js';

export class PlanValidationError extends Error {
  constructor(
    code: string,
    plan: ExecutionPlan,
    missingInfo: ReturnType<typeof detectMissingParameters>
  ) {
    super(code);
    (this as any).plan = plan;
    (this as any).missingInfo = missingInfo;
  }
}

export function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isEmptyOrInvalidId(value: unknown): boolean {
  // Null/undefined/empty string
  if (!value || (typeof value === 'string' && value.trim() === '')) return true;

  // Not a valid UUID
  if (!isValidUUID(value)) return true;

  return false;
}

export function handleMissingIdsFallback(
  step: any,
  tool: ToolDefinition | undefined,
  availableIds: Record<string, { value: string; entityType?: string }>,
  results: ToolResult[]
): boolean {
  if (!tool || !tool.idFields || tool.idFields.length === 0) {
    return false;
  }

  // Categorize tool if not explicitly set
  const toolName = step.toolName;
  const category =
    tool.category ||
    (toolName.startsWith('search') ? 'search' :
     toolName.startsWith('create') ? 'create' :
     toolName.startsWith('get') ? 'read' :
     ['update', 'move', 'generate', 'delete'].some(prefix => toolName.startsWith(prefix)) ? 'mutation' : 'read');

  const missingIdFields = tool.idFields.filter(
    (f) => !step.stepInputs || !(f in step.stepInputs)
  );

  if (missingIdFields.length === 0) return false;

  // Try to find matching IDs from context for each missing field
  const matchedIds: Record<string, string> = {};
  for (const idField of missingIdFields) {
    const entityType = tool.idMapping?.[idField];
    if (!entityType) continue;

    // Look for matching entity in available IDs
    const matchedId = Object.values(availableIds).find((id) => id.entityType === entityType);
    if (matchedId) {
      matchedIds[idField] = matchedId.value;
    }
  }

  if (Object.keys(matchedIds).length === 0) return false; // No IDs found

  // STRATEGY: Based on tool category, decide if we can fallback
  if (category === 'search') {
    // For search tools: if we have the entity ID, skip the search
    logger.info({ tool: toolName, matchedIds }, 'skipping search step, entity ID already available in context');
    results.push({ toolName: step.toolName, result: [], error: undefined });
    return true; // Skip this step
  }

  if (category === 'mutation' || category === 'create') {
    // For mutation/create tools: inject the missing IDs from context
    step.stepInputs = step.stepInputs || {};
    Object.assign(step.stepInputs, matchedIds);
    logger.info({ tool: toolName, injectedIds: Object.keys(matchedIds) }, 'injected missing entity IDs from context memory');
    return false; // Continue execution with updated inputs
  }

  return false; // No fallback for read-only tools without IDs
}

export function extractEntityNameFromMessage(message: string, entityType: string): string | null {
  // Pattern 1: explicitly quoted name — most reliable, language-agnostic
  const quotedMatch = message.match(/["']([^"']{2,})["']/);
  if (quotedMatch) {
    logger.debug({ extracted: quotedMatch[1], entityType, pattern: 'quoted' }, 'extracted entity name from quoted string');
    return quotedMatch[1].trim();
  }

  // Pattern 2: entity type keyword (from system vocabulary) followed by the name
  // Matches: "lead John Doe", "lead-ul John Doe", "deal: Mega Contract"
  const entityPattern = new RegExp(`\\b${entityType}[^\\w]*([\\w]+(?:\\s+[\\w]+)+)`, 'i');
  const entityMatch = message.match(entityPattern);
  if (entityMatch?.[1]) {
    const extracted = entityMatch[1].trim();
    logger.debug({ extracted, entityType, pattern: 'entity-type-prefix' }, 'extracted entity name via entity-type prefix');
    return extracted;
  }

  // Pattern 3: two or more consecutive Title Case words (proper noun heuristic)
  // Works for names like "John Doe", "Acme Corp", "John Smith" in any language
  const properNounMatch = message.match(/\b([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ][a-zàáâãäåèéêëìíîïòóôõöùúûü]+(?:\s+[A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ][a-zàáâãäåèéêëìíîïòóôõöùúûü]+)+)\b/);
  if (properNounMatch?.[1]) {
    logger.debug({ extracted: properNounMatch[1], entityType, pattern: 'proper-noun' }, 'extracted entity name via proper noun heuristic');
    return properNounMatch[1].trim();
  }

  return null;
}

export function insertPrerequisiteSteps(
  plan: ExecutionPlan,
  tools: ToolDefinition[],
  userMessage: string
): ExecutionPlan {
  const newSteps: ExecutionPlan['steps'] = [];
  let stepOrder = 1;

  for (const step of plan.steps) {
    // Ensure stepInputs exists
    if (!step.stepInputs) step.stepInputs = {};

    const tool = tools.find(t => t.name === step.toolName);
    const idFieldsToInsert: Array<{ field: string; value: string; entityType: string }> = [];

    // Detect invalid/empty ID parameters
    if (tool?.idFields && step.stepInputs) {
      for (const idField of tool.idFields) {
        const value = step.stepInputs[idField];

        // Check if this ID is empty, null, or invalid
        if (isEmptyOrInvalidId(value)) {
          const entityType = tool.idMapping?.[idField];
          if (entityType) {
            // Try to extract entity name from user message
            const extractedName = extractEntityNameFromMessage(userMessage, entityType);

            if (extractedName) {
              idFieldsToInsert.push({ field: idField, value: extractedName, entityType });
            }
          }
        }
      }
    }

    // Insert prerequisite search steps for each invalid ID
    for (const { field, value, entityType } of idFieldsToInsert) {
      const searchTool = tools.find(
        t =>
          t.category === 'search' &&
          t.outputFields?.includes('id') &&
          t.idMapping?.['id'] === entityType
      );

      if (searchTool) {
        logger.info({ field, value, entityType, searchTool: searchTool.name }, 'inserting prerequisite search step for missing ID');

        // Find the text search parameter dynamically from the tool definition
        // (the first non-ID, non-output string parameter that isn't required to be an ID)
        const idAndOutputFields = new Set([
          ...(searchTool.idFields || []),
          ...(searchTool.outputFields || []),
        ]);
        const searchParamName = Object.entries(searchTool.parameters.properties)
          .find(([name, prop]: [string, any]) =>
            !idAndOutputFields.has(name) &&
            (prop?.type === 'string' || !prop?.type)
          )?.[0] ?? 'query';

        newSteps.push({
          order: stepOrder++,
          toolName: searchTool.name,
          description: `Search for ${entityType} matching: ${value}`,
          dependencies: [],
          stepInputs: { [searchParamName]: value },
        });

        // Update current step to reference the search result
        if (step.stepInputs) {
          step.stepInputs[field] = `<${entityType}Id from step ${stepOrder - 1}>`;
        }
      }
    }

    // Add original step with incremented order
    step.order = stepOrder++;
    newSteps.push(step);
  }

  return { ...plan, steps: newSteps };
}
