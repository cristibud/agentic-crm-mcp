import { logger } from '../logger.js';
import type { Settings, ToolDefinition } from '../types/types.js';
import { createExecutionPlan, type ExecutionPlan } from './planner.js';
import { cleanPlanStepInputs } from './planCleaner.js';
import { PlanValidationError, insertPrerequisiteSteps, isEmptyOrInvalidId } from './planRepairer.js';
import { validatePlan, detectMissingParameters, fillMissingParamsFromContext } from '../validation/planValidator.js';
import { contextMemoryManager } from '../memory/contextMemory.js';
import { type BaselineConfig, DEFAULT_BASELINE_CONFIG } from '../types/BaselineConfig.js';

function detectParameterMismatches(
  plan: ExecutionPlan,
  tools: ToolDefinition[]
): Array<{ stepName: string; reason: string }> {
  const mismatches: Array<{ stepName: string; reason: string }> = [];

  for (const step of plan.steps) {
    const tool = tools.find(t => t.name === step.toolName);
    if (!tool) continue;

    const stepInputKeys = Object.keys(step.stepInputs || {});
    const acceptedParams = Object.keys(tool.parameters?.properties || {});

    logger.debug({ stepName: step.toolName, stepInputKeys, acceptedParams }, 'checking parameter mismatch');

    for (const key of stepInputKeys) {
      if (!acceptedParams.includes(key)) {
        mismatches.push({
          stepName: step.toolName,
          reason: `step provides "${key}" but tool does not accept it (accepts: ${acceptedParams.join(', ')})`,
        });
        logger.warn({ step: step.toolName, providedParam: key, acceptedParams }, 'parameter mismatch');
      }
    }

    const requiredParams = tool.parameters?.required || [];
    const missingRequired = requiredParams.filter(p => !(p in (step.stepInputs || {})));
    if (missingRequired.length > 0) {
      const anyIdFieldMissing = (tool.idFields || []).some(f => missingRequired.includes(f));
      if (anyIdFieldMissing) {
        mismatches.push({
          stepName: step.toolName,
          reason: `missing required ID fields: ${missingRequired.join(', ')}`,
        });
        logger.warn({ step: step.toolName, missingRequired }, 'missing required ID parameters');
      }
    }
  }

  return mismatches;
}

export async function createOrRepairPlan(
  userMessage: string,
  tools: ToolDefinition[],
  settings: Settings,
  sessionId?: string,
  baselineConfig: BaselineConfig = DEFAULT_BASELINE_CONFIG
): Promise<ExecutionPlan> {
  let contextSummary: string | undefined;

  if (sessionId) {
    contextMemoryManager.addMessage(sessionId, 'user', userMessage);
    contextSummary = contextMemoryManager.getContextSummary(sessionId, tools);
  }

  let plan = await createExecutionPlan(userMessage, tools, settings, contextSummary);
  cleanPlanStepInputs(plan);

  let iteration = 0;
  const maxIterations = baselineConfig.disablePlanRepair ? 1 : 3;

  logger.info({ plan }, 'initial plan generated');

  while (iteration < maxIterations) {
    iteration++;
    logger.info({ iteration, maxIterations }, `plan repair iteration ${iteration}/${maxIterations}`);

    if (sessionId) {
      const contextMemory = contextMemoryManager.getSession(sessionId);
      if (contextMemory) fillMissingParamsFromContext(plan, tools, contextMemory);
    }

    if (baselineConfig.disablePlanValidation) {
      logger.info('plan validation disabled (baseline mode), skipping');
      return plan;
    }

    const errors = validatePlan(plan, tools);
    logger.debug({ iteration, errorCount: errors.length }, 'plan validation result');

    if (!errors.length) {
      logger.info('plan validated, proceeding to execution');
      return plan;
    }

    const missingInfo = detectMissingParameters(plan, tools);
    if (missingInfo?.hasMissing) {
      logger.error({ iteration, missingInfo }, 'missing required parameters — user input needed');
      throw new PlanValidationError('MISSING_PARAMS', plan, missingInfo);
    }

    const parameterMismatches = detectParameterMismatches(plan, tools);

    const invalidIdDetected = plan.steps.some(step => {
      const tool = tools.find(t => t.name === step.toolName);
      if (tool?.idFields && step.stepInputs) {
        return tool.idFields.some(field => {
          const value = step.stepInputs?.[field];
          const invalid = isEmptyOrInvalidId(value);
          if (invalid) {
            logger.warn({ step: step.toolName, field, value }, 'invalid ID value in step inputs');
          }
          return invalid;
        });
      }
      return false;
    });

    logger.info(
      { iteration, invalidIdDetected, mismatchCount: parameterMismatches.length },
      'issue detection complete'
    );

    if (invalidIdDetected || parameterMismatches.length > 0) {
      if (iteration < maxIterations) {
        logger.info({ iteration, maxIterations }, 'reorganizing or regenerating plan');

        if (invalidIdDetected) {
          logger.info('inserting prerequisite search steps for missing IDs');
          plan = insertPrerequisiteSteps(plan, tools, userMessage || '');

          const stillInvalid = plan.steps.some(step => {
            const tool = tools.find(t => t.name === step.toolName);
            if (tool?.idFields && step.stepInputs) {
              return tool.idFields.some(field => isEmptyOrInvalidId(step.stepInputs?.[field]));
            }
            return false;
          });

          if (!stillInvalid) {
            logger.info('local reorganization resolved invalid IDs');
            continue;
          }

          logger.warn('local reorganization did not fully resolve invalid IDs');
        }

        const stillInvalidAfterReorg = plan.steps.some(step => {
          const tool = tools.find(t => t.name === step.toolName);
          if (tool?.idFields && step.stepInputs) {
            return tool.idFields.some(f => isEmptyOrInvalidId(step.stepInputs?.[f]));
          }
          return false;
        });

        if ((invalidIdDetected && stillInvalidAfterReorg) || parameterMismatches.length > 0) {
          logger.info({ iteration, parameterMismatches }, 'requesting fresh plan from LLM');

          const mismatchDetails = parameterMismatches.map(m => `- ${m.stepName}: ${m.reason}`).join('\n');
          const hint = parameterMismatches.length > 0
            ? `The previous plan had issues:\n${mismatchDetails}\n\nEach tool must use only its declared parameters.`
            : `You must search for entities by name before operating on them.`;

          logger.debug({ hint }, 'sending repair hint to LLM');

          plan = await createExecutionPlan(`${userMessage}\n\n${hint}`, tools, settings, contextSummary);
          cleanPlanStepInputs(plan);

          logger.info({ iteration }, 'fresh plan generated');
          if (sessionId) contextMemoryManager.logEvent(sessionId, { event: 'plan_repair_attempt', iteration, reason: 'invalid_ids_or_mismatch' });
          continue;
        }
      }
    } else {
      logger.info('validation errors without invalid IDs — requesting replan');
      const detailedErrors = errors.map(e => `${e.step}/${e.toolName}: ${e.issue}`).join('\n');
      plan = await createExecutionPlan(`${userMessage}\n\nFix: ${detailedErrors}`, tools, settings);
      cleanPlanStepInputs(plan);
      if (sessionId) contextMemoryManager.logEvent(sessionId, { event: 'plan_repair_attempt', iteration, reason: 'validation_errors' });
      continue;
    }
  }

  logger.error({ maxIterations }, 'plan generation failed after max iterations');
  throw new Error('Plan generation failed after maximum retry iterations');
}
