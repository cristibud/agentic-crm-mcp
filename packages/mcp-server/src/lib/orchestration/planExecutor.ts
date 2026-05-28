import { logger } from '../logger.js';
import { contextMemoryManager } from '../memory/contextMemory.js';
import { extractIds, flattenIds, normalizeToolInputs, mapIdsForTool } from '../extraction/idMapper.js';
import { handleMissingIdsFallback } from './planRepairer.js';
import type { ToolDefinition } from '../types/types.js';
import type { ExecutionPlan, PlanStep } from '../../types/Planning.js';
import type { ToolResult, ExecutionTrace } from '../../types/ToolExecution.js';

export function detectPlaceholders(
  stepInputs: Record<string, any>
): Array<{ field: string; value: string; description: string }> {
  const placeholders: Array<{ field: string; value: string; description: string }> = [];
  for (const [field, value] of Object.entries(stepInputs)) {
    if (typeof value === 'string' && value.startsWith('<') && value.endsWith('>')) {
      placeholders.push({ field, value, description: value.slice(1, -1) });
    }
  }
  return placeholders;
}

export function extractSearchQuery(placeholder: string): { query: string; entityType: string | null; stepRef?: number } {
  const stepRefMatch = placeholder.match(/(\w+)Id?\s+from\s+(?:step\s+)?(\d+)/);
  if (stepRefMatch) {
    return { query: '', entityType: stepRefMatch[1], stepRef: parseInt(stepRefMatch[2], 10) };
  }
  const match = placeholder.match(/(.+?)'s\s+(\w+)\s+ID/);
  if (match) return { query: match[1], entityType: match[2] };
  const entityMatch = placeholder.match(/(\w+)\s+ID\s*(?:from)?/);
  if (entityMatch) return { query: placeholder, entityType: entityMatch[1] };
  return { query: placeholder, entityType: null };
}

export async function executeWithPlaceholderResolution(
  plan: ExecutionPlan,
  tools: ToolDefinition[],
  toolExecutors: Record<string, (args: any) => Promise<any>>,
  allExtractedIds: Record<string, { value: string; entityType?: string }>,
  results?: ToolResult[]
): Promise<void> {
  for (const step of plan.steps) {
    if (!step.stepInputs) continue;
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool) continue;

    for (const placeholder of detectPlaceholders(step.stepInputs)) {
      const { query, entityType, stepRef } = extractSearchQuery(placeholder.description);
      if (!step.stepInputs) step.stepInputs = {};

      if (stepRef !== undefined && results) {
        const prevStepResult = results[stepRef - 1];
        const resultId = prevStepResult?.extractedIds ? Object.values(prevStepResult.extractedIds)[0] : undefined;
        if (resultId) {
          step.stepInputs[placeholder.field] = resultId;
          logger.info({ field: placeholder.field, stepRef, id: resultId }, 'resolved step reference placeholder');
          continue;
        }
      }

      if (!query) continue;
      const searchTool = entityType
        ? tools.find(t => t.category === 'search' && t.outputFields?.includes('id') && t.idMapping?.['id'] === entityType)
        : undefined;

      if (!searchTool || !toolExecutors[searchTool.name]) {
        logger.warn({ placeholder: placeholder.value, entityType, query }, 'no search tool found for placeholder');
        continue;
      }

      try {
        const idAndOutputFields = new Set([
          ...(searchTool.idFields || []),
          ...(searchTool.outputFields || []),
        ]);
        const searchParamName = Object.entries(searchTool.parameters.properties)
          .find(([name, prop]: [string, any]) =>
            !idAndOutputFields.has(name) &&
            (prop?.type === 'string' || !prop?.type)
          )?.[0] ?? 'query';

        const searchResult = await toolExecutors[searchTool.name]({ [searchParamName]: query });
        if (Array.isArray(searchResult) && searchResult.length > 0 && 'id' in searchResult[0]) {
          step.stepInputs[placeholder.field] = searchResult[0].id;
          allExtractedIds[placeholder.field] = {
            value: searchResult[0].id,
            entityType: searchTool.idMapping?.['id'] || entityType || 'unknown',
          };
          logger.info({ field: placeholder.field, id: searchResult[0].id }, 'placeholder resolved via search');
        }
      } catch (error) {
        logger.warn({ placeholder: placeholder.value, error }, 'placeholder resolution failed');
      }
    }
  }
}

function resolveStepReferences(
  step: PlanStep,
  results: ToolResult[],
  plan: ExecutionPlan
): void {
  if (!step.stepInputs) step.stepInputs = {};
  for (const placeholder of detectPlaceholders(step.stepInputs)) {
    const { stepRef } = extractSearchQuery(placeholder.description);
    if (stepRef === undefined) continue;
    const prevResult = results.find(r => r.toolName === plan.steps[stepRef - 1]?.toolName);
    const prevId = prevResult?.extractedIds ? Object.values(prevResult.extractedIds)[0] : undefined;
    if (prevId) {
      step.stepInputs[placeholder.field] = prevId;
      logger.info({ field: placeholder.field, stepRef, id: prevId }, 'resolved step reference from prior result');
    }
  }
}

async function executeToolStep(
  step: PlanStep,
  tool: ToolDefinition | undefined,
  executor: (args: any) => Promise<any>,
  allExtractedIds: Record<string, { value: string; entityType?: string }>,
  results: ToolResult[],
  trace: ExecutionTrace[],
  sessionId?: string
): Promise<boolean> {
  const mappedIds = mapIdsForTool(step.toolName, tool, allExtractedIds);
  const missingIds = tool?.idFields?.filter(f => !mappedIds[f]) || [];

  if (missingIds.length > 0) {
    logger.error({ step: step.order, missingIds }, 'missing required IDs');
    if (handleMissingIdsFallback(step, tool, allExtractedIds, results)) return false;
    const errMsg = `Missing IDs: ${missingIds.join(', ')}`;
    if (sessionId) contextMemoryManager.addFailedExecution(sessionId, step.toolName, step.stepInputs || {}, errMsg);
    results.push({ toolName: step.toolName, result: null, error: errMsg });
    return true;
  }

  const toolInputs = { ...step.stepInputs, ...mappedIds };
  const missingParams = (tool?.parameters.required || []).filter(p => !(p in toolInputs));
  if (missingParams.length > 0) {
    const errMsg = `Missing params: ${missingParams.join(', ')}`;
    if (sessionId) contextMemoryManager.addFailedExecution(sessionId, step.toolName, toolInputs, errMsg);
    results.push({ toolName: step.toolName, result: null, error: errMsg });
    return true;
  }

  const normalizedInputs = normalizeToolInputs(toolInputs, tool);
  logger.debug({ toolName: step.toolName, normalizedInputs }, 'normalized tool inputs');

  try {
    const result = await executor(normalizedInputs);
    if (sessionId) contextMemoryManager.logEvent(sessionId, { event: 'tool_called', toolName: step.toolName });
    if (!result || (Array.isArray(result) && !result.length && step.order < Infinity)) {
      logger.warn({ step: step.order, toolName: step.toolName }, 'empty result from tool');
      results.push({ toolName: step.toolName, result: [], error: 'No results found' });
      return false;
    }

    const extractedIds = extractIds(result, step.toolName, tool);
    Object.assign(allExtractedIds, extractedIds);
    results.push({ toolName: step.toolName, result, extractedIds: flattenIds(extractedIds), extractedIdsWithTypes: extractedIds, usedIds: mappedIds });
    if (sessionId) contextMemoryManager.addExecutionResult(sessionId, step.toolName, result, tool);
    trace.push({
      stepOrder: step.order,
      toolName: step.toolName,
      inputIds: mappedIds,
      outputIds: flattenIds(extractedIds),
      result,
      metadata: {
        idFieldsRequired: tool?.idFields || [],
        idFieldsExtracted: tool?.outputFields || [],
        extractedIdTypes: Object.fromEntries(Object.entries(extractedIds).map(([k, v]) => [k, v.entityType || 'unknown'])),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error';
    if (sessionId) contextMemoryManager.addFailedExecution(sessionId, step.toolName, normalizedInputs, err);
    results.push({ toolName: step.toolName, result: null, error: err });
    trace.push({ stepOrder: step.order, toolName: step.toolName, inputIds: {}, outputIds: {}, result: null, error: err });
  }
  return false;
}

export function makeActionableError(
  toolName: string,
  error: string,
  results: ToolResult[],
  tools: ToolDefinition[],
  referencedEntities: Record<string, any>
): string {
  // Pattern: "Missing IDs: leadId, dealId" (generic — orice ID)
  const missingIdsMatch = error.match(/Missing IDs?:\s*(.+)/i);
  if (missingIdsMatch) {
    const missingIds = missingIdsMatch[1].split(',').map(s => s.trim());
    const failedTool = tools.find(t => t.name === toolName);
    if (!failedTool || !failedTool.idMapping) {
      return `Tool "${toolName}" failed: ${error}`;
    }

    // For each missing ID, derive the entity type generically
    const insights: string[] = [];
    for (const idField of missingIds) {
      const entityType = failedTool.idMapping[idField];
      if (!entityType) continue;

      // Check generic: does an entity of this type exist in memory?
      const lastKey = `last${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
      const entityExists = referencedEntities && referencedEntities[lastKey];

      // Check generic: did any previous step in results create such entity?
      const createdInPriorStep = results.some(r => {
        if (r.error) return false;
        const tool = tools.find(t => t.name === r.toolName);
        if (!tool) return false;
        const outputsThisEntity = (tool.outputFields || []).some(out => 
          tool.idMapping?.[out] === entityType
        );
        return outputsThisEntity && tool.category === 'create';
      });

      if (!entityExists && !createdInPriorStep) {
        insights.push(
          `Tool "${toolName}" needs a "${idField}" (entity type: "${entityType}"), ` +
          `but no "${entityType}" exists in this conversation yet. ` +
          `Consider calling a 'create' tool that outputs a "${entityType}" ID before "${toolName}".`
        );
      } else {
        insights.push(
          `Tool "${toolName}" needs a "${idField}" (entity type: "${entityType}"), ` +
          `which exists in context but was not propagated to this step. ` +
          `Check parameter mapping between steps.`
        );
      }
    }
    return insights.join('\n');
  }

  // Pattern: search returned empty results
  if (/empty|no results|not found/i.test(error)) {
    const failedTool = tools.find(t => t.name === toolName);
    const category = failedTool?.category || 'unknown';
    return (
      `Tool "${toolName}" (category: ${category}) returned no results. ` +
      `If the user wants to operate on a new entity, consider creating it first ` +
      `with a tool of category 'create'.`
    );
  }

  // Pattern: business rule violation (state machine, validation, etc.)
  if (/invalid|not allowed|forbidden/i.test(error)) {
    return (
      `Tool "${toolName}" was rejected by business rules: ${error}. ` +
      `The requested operation may violate constraints. Consider intermediate steps ` +
      `or alternative approaches.`
    );
  }

  // Default — return original with light formatting
  return `Tool "${toolName}" failed: ${error}`;
}

export async function executePlan(
  plan: ExecutionPlan,
  tools: ToolDefinition[],
  toolExecutors: Record<string, (args: any) => Promise<any>>,
  sessionId?: string,
  userMessage?: string,
  completedSteps?: Map<string, ToolResult>
): Promise<{ results: ToolResult[]; trace: ExecutionTrace[] }> {
  const results: ToolResult[] = [];
  const trace: ExecutionTrace[] = [];
  const allExtractedIds: Record<string, { value: string; entityType?: string }> = {};

  if (sessionId) {
    const ctx = contextMemoryManager.getSession(sessionId);
    for (const [key, data] of Object.entries(ctx?.lastReferencedEntities || {})) {
      if (typeof data === 'object' && data !== null && 'value' in data && typeof (data as any).value === 'string') {
        allExtractedIds[key] = data as { value: string; entityType?: string };
      }
    }
  }

  if (completedSteps) {
    for (const [, prevResult] of completedSteps) {
      if (prevResult.extractedIdsWithTypes) {
        Object.assign(allExtractedIds, prevResult.extractedIdsWithTypes);
      }
    }
  }

  if (userMessage) {
    for (const step of plan.steps) { if (!step.stepInputs) step.stepInputs = {}; }
    await executeWithPlaceholderResolution(plan, tools, toolExecutors, allExtractedIds);
  }

  for (const step of plan.steps) {
    const executor = toolExecutors[step.toolName];
    if (!executor) { results.push({ toolName: step.toolName, result: null, error: 'Tool not found' }); continue; }

    const priorSuccess = completedSteps?.get(step.toolName);
    if (priorSuccess) {
      results.push(priorSuccess);
      logger.info({ toolName: step.toolName }, 'skipping step completed in prior attempt');
      continue;
    }

    resolveStepReferences(step, results, plan);

    const tool = tools.find(t => t.name === step.toolName);
    const shouldBreak = await executeToolStep(step, tool, executor, allExtractedIds, results, trace, sessionId);
    if (shouldBreak) break;
  }

  return { results, trace };
}
