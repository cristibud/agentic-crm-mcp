import { logger } from '../logger.js';
import type { ToolDefinition } from '../types/types.js';
import type { ExecutionPlan } from '../../types/Planning.js';
import type { ValidationError, MissingParametersInfo } from '../../types/Validation.js';

export function validatePlan(
  plan: ExecutionPlan,
  tools: ToolDefinition[]
): ValidationError[] {
  for (const step of plan.steps) {
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool || !step.stepInputs) continue;

    const idFieldNames = Object.keys(step.stepInputs).filter(
      key => key.endsWith('Id') || key.endsWith('ID') || (tool.idFields && tool.idFields.includes(key))
    );

    for (const idField of idFieldNames) {
      logger.debug({ step: step.order, removedField: idField }, 'removing ID field from stepInputs');
      delete step.stepInputs[idField];
    }
  }

  const errors: ValidationError[] = [];
  const idsAvailableAfterStep: Map<string, string> = new Map();

  for (const step of plan.steps) {
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool) {
      errors.push({ step: step.order, toolName: step.toolName, issue: `Tool not found` });
      continue;
    }

    // Check: are all required non-ID params present in stepInputs?
    const requiredParams = tool.parameters.required || [];
    const idFields = tool.idFields || [];
    for (const param of requiredParams) {
      if (idFields.includes(param)) continue;
      if (!step.stepInputs || !(param in step.stepInputs)) {
        errors.push({
          step: step.order,
          toolName: step.toolName,
          issue: `Missing required param "${param}" in stepInputs`
        });
      }
    }

    // Check: stepInputs shouldn't contain ID fields
    for (const idField of idFields) {
      if (step.stepInputs && idField in step.stepInputs) {
        errors.push({
          step: step.order,
          toolName: step.toolName,
          issue: `ID field "${idField}" found in stepInputs — should come from previous step, not as literal value`
        });
      }
    }

    // Check: can required IDs be satisfied by previous steps?
    for (const idField of idFields) {
      const requiredEntityType = tool.idMapping?.[idField];
      if (requiredEntityType && !idsAvailableAfterStep.has(requiredEntityType)) {
        if (step.order > 1) {
          errors.push({
            step: step.order,
            toolName: step.toolName,
            issue: `Needs "${idField}" (entity: ${requiredEntityType}) but no previous step produces it`
          });
        }
      }
    }

    // Check: enum values are valid
    for (const [param, value] of Object.entries(step.stepInputs || {})) {
      const paramDef = tool.parameters.properties[param] as { enum?: string[] } | undefined;
      if (paramDef?.enum && typeof value === 'string') {
        if (!paramDef.enum.includes(value)) {
          errors.push({
            step: step.order,
            toolName: step.toolName,
            issue: `Invalid enum value "${value}" for "${param}". Valid: [${paramDef.enum.join(', ')}]`
          });
        }
      }
    }

    // Check: all step inputs are accepted by tool (no unexpected parameters)
    const acceptedParams = Object.keys(tool.parameters.properties);
    for (const param of Object.keys(step.stepInputs || {})) {
      if (!acceptedParams.includes(param)) {
        errors.push({
          step: step.order,
          toolName: step.toolName,
          issue: `Unexpected parameter "${param}" not accepted by tool. Tool accepts: [${acceptedParams.join(', ')}]`
        });
      }
    }

    // Register what IDs this step will produce
    if (tool.outputFields && tool.idMapping) {
      for (const field of tool.outputFields) {
        const entityType = tool.idMapping[field];
        if (entityType) {
          idsAvailableAfterStep.set(entityType, `step${step.order}`);
        }
      }
    }
  }

  return errors;
}

export function detectMissingParameters(
  plan: ExecutionPlan,
  tools: ToolDefinition[]
): MissingParametersInfo | null {
  for (const step of plan.steps) {
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool) continue;

    const requiredParams = tool.parameters.required || [];
    const idFields = tool.idFields || [];
    const missing: MissingParametersInfo['missingParams'] = [];

    for (const param of requiredParams) {
      if (idFields.includes(param)) continue;

      const value = step.stepInputs?.[param];

      if (value === undefined || value === null || value === '') {
        const paramDef = tool.parameters.properties[param] as any;
        missing.push({
          name: param,
          type: paramDef?.type,
          description: paramDef?.description,
        });
      }
    }

    if (missing.length > 0) {
      return {
        hasMissing: true,
        toolName: step.toolName,
        missingParams: missing,
      };
    }
  }

  return null;
}

export function fillMissingParamsFromContext(
  plan: ExecutionPlan,
  tools: ToolDefinition[],
  contextMemory?: { extractedContext?: Record<string, any> }
): void {
  if (!contextMemory?.extractedContext) return;

  for (const step of plan.steps) {
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool) continue;

    if (!step.stepInputs) step.stepInputs = {};

    const requiredParams = tool.parameters.required || [];
    const idFields = tool.idFields || [];

    for (const param of requiredParams) {
      if (idFields.includes(param)) continue;
      if (param in step.stepInputs && step.stepInputs[param]) continue;

      const paramLower = param.toLowerCase();
      const capitalised = param.charAt(0).toUpperCase() + param.slice(1);
      const keysToTry = [
        param,                  // exact: "email"
        `last${capitalised}`,   // prefixed: "lastEmail"
        paramLower,             // lowercase: "email"
        `last${paramLower}`,    // lowercase prefixed: "lastemail"
      ];

      for (const contextKey of keysToTry) {
        const contextValue = contextMemory.extractedContext![contextKey];
        if (contextValue) {
          step.stepInputs[param] = contextValue;
          logger.debug(
            { step: step.order, tool: step.toolName, param, contextKey, value: contextValue },
            'filled missing parameter from context memory'
          );
          break;
        }
      }
    }
  }
}
