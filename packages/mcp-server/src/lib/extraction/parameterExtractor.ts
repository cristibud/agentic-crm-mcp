import { logger } from '../logger.js';
import type { ToolDefinition } from '../types/types.js';
import type { ParameterExtractionResult, PendingPlanState } from '../../types/Planning.js';
import type { ContextMemory } from '../../types/ContextMemory.js';
import { resolveValue, extractFromContextMemory, extractFromUserMessage, extractFromContextFallback } from './parameterExtractionHelpers.js';

function detectValueType(value: string): {
  type: 'email' | 'phone' | 'number' | 'percentage' | 'text' | 'enum';
} {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { type: 'email' };
  if (/^[\+]?[\d\s\-\(\)]{7,}$/.test(value)) return { type: 'phone' };
  if (/^\d+%$/.test(value)) return { type: 'percentage' };
  if (/^\d+(\.\d+)?$/.test(value)) return { type: 'number' };
  return { type: 'text' };
}

function isValueTypeCompatible(value: string, paramName: string, paramDef?: any): boolean {
  const valueType = detectValueType(value);
  if (paramDef?.enum) {
    if (valueType.type === 'email' || valueType.type === 'phone') return false;
    return paramDef.enum.some((e: string) => e.toLowerCase() === value.toLowerCase());
  }
  if (paramDef?.type === 'number') return valueType.type === 'number' || valueType.type === 'percentage';
  if (paramDef?.type === 'string') {
    if (paramName.toLowerCase().includes('email')) return valueType.type === 'email' || valueType.type === 'text';
    if (paramName.toLowerCase().includes('phone')) return valueType.type === 'phone' || valueType.type === 'text';
    return true;
  }
  return true;
}

export function extractAndCompletePlan(
  userMessage: string,
  pendingState: PendingPlanState,
  contextMemory?: ContextMemory,
  toolDefs?: ToolDefinition[],
): ParameterExtractionResult {
  const plan = JSON.parse(JSON.stringify(pendingState.plan));
  const firstStep = plan.steps[0];

  if (!firstStep) {
    return { completedPlan: null, extractedParams: {}, missingParams: pendingState.missingParams };
  }

  const missingParamNames = pendingState.missingParams.map(p => p.name);

  // Bind resolveValue with the local isValueTypeCompatible
  const resolveFn = (raw: string, paramName: string, paramDef: any) =>
    resolveValue(raw, paramName, paramDef, isValueTypeCompatible);

  const fromContext = extractFromContextMemory(missingParamNames, contextMemory, toolDefs, pendingState);

  const stillMissingAfterContext = missingParamNames.filter(p => !fromContext[p]);
  const fromMessage = extractFromUserMessage(userMessage, stillMissingAfterContext, toolDefs, pendingState, resolveFn);

  const extracted: Record<string, string> = { ...fromContext, ...fromMessage };

  // fallback: scan context for anything still missing
  const remainingMissing = missingParamNames.filter(p => !extracted[p]);
  if (remainingMissing.length > 0) {
    const fallback = extractFromContextFallback(remainingMissing, contextMemory);
    Object.assign(extracted, fallback);
  }

  const finalMissing = missingParamNames.filter(p => !extracted[p]);

  if (Object.keys(extracted).length === 0) {
    logger.warn({ expectedParams: missingParamNames }, 'no parameters extracted from user message');
    return { completedPlan: null, extractedParams: {}, missingParams: pendingState.missingParams };
  }

  if (!firstStep.stepInputs) firstStep.stepInputs = {};
  for (const [paramName, value] of Object.entries(extracted)) {
    firstStep.stepInputs[paramName] = value;
  }

  const completedPlan = finalMissing.length === 0 ? plan : null;

  logger.info(
    { completedParams: Object.keys(extracted), remainingMissing: finalMissing, toolName: pendingState.toolName },
    `extracted ${Object.keys(extracted).length}/${missingParamNames.length} parameters`
  );

  return {
    completedPlan,
    extractedParams: extracted,
    missingParams: finalMissing.map(param => pendingState.missingParams.find(p => p.name === param)!),
  };
}
