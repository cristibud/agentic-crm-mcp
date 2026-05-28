import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { logger } from '../logger.js';
import type { Settings, ToolDefinition } from '../types/types.js';
import { contextMemoryManager } from '../memory/contextMemory.js';
import { validatePlan, fillMissingParamsFromContext } from '../validation/planValidator.js';
import { createOrRepairPlan } from './planCreator.js';
import { executePlan, makeActionableError } from './planExecutor.js';
import { PlanValidationError } from './planRepairer.js';
import { type BaselineConfig, DEFAULT_BASELINE_CONFIG } from '../types/BaselineConfig.js';

export { extractAndCompletePlan } from '../extraction/parameterExtractor.js';
export type { ToolResult, ExecutionTrace, OrchestrationResult, PendingPlanState } from '../../types/ToolExecution.js';
export type { ParameterExtractionResult } from '../../types/Planning.js';

import type { ToolResult, ExecutionTrace, OrchestrationResult } from '../../types/ToolExecution.js';
import type { ExecutionPlan } from '../../types/Planning.js';

export async function orchestrateTools(
  userMessage: string,
  tools: ToolDefinition[],
  toolExecutors: Record<string, (args: any) => Promise<any>>,
  conversationHistory: ChatCompletionMessageParam[],
  settings: Settings,
  preParsedPlan?: ExecutionPlan,
  sessionId?: string,
  baselineConfig: BaselineConfig = DEFAULT_BASELINE_CONFIG,
): Promise<OrchestrationResult> {
  const client = new OpenAI({ apiKey: settings.llmApiKey, baseURL: settings.llmBaseUrl });

  try {
    let plan: ExecutionPlan;

    if (preParsedPlan) {
      logger.info('using pre-parsed plan');
      plan = preParsedPlan;
      if (sessionId) {
        const ctx = contextMemoryManager.getSession(sessionId);
        if (ctx) fillMissingParamsFromContext(plan, tools, ctx);
      }
      if (!baselineConfig.disablePlanValidation && validatePlan(plan, tools).length > 0) {
        throw new Error('Pre-parsed plan invalid');
      }
    } else {
      try {
        plan = await createOrRepairPlan(userMessage, tools, settings, sessionId, baselineConfig);
      } catch (err) {
        if (err instanceof PlanValidationError) {
          const paramList = (err as any).missingInfo.missingParams
            .map((p: any) => `- **${p.name}**${p.type ? ` (${p.type})` : ''}`)
            .join('\n');

          if (sessionId) contextMemoryManager.logEvent(sessionId, { event: 'pending_plan_created', toolName: (err as any).missingInfo.toolName, missingParams: (err as any).missingInfo.missingParams.map((p: any) => p.name) });

          return {
            plan: (err as any).plan,
            executionResults: [],
            executionTrace: [],
            finalResponse: `I need: ${paramList}`,
            messages: [...conversationHistory, { role: 'user', content: userMessage }, { role: 'assistant', content: `I need: ${paramList}` }],
            pendingPlanState: {
              plan: (err as any).plan,
              missingParams: (err as any).missingInfo.missingParams,
              toolName: (err as any).missingInfo.toolName,
            },
          };
        }
        throw err;
      }
    }

    const MAX_EXECUTION_RETRIES = baselineConfig.disableExecutionRetry ? 0 : 2;
    let results: ToolResult[] = [];
    let trace: ExecutionTrace[] = [];
    let executionAttempt = 0;
    let completedSteps: Map<string, ToolResult> | undefined;

    while (executionAttempt <= MAX_EXECUTION_RETRIES) {
      ({ results, trace } = await executePlan(plan, tools, toolExecutors, sessionId, userMessage, completedSteps));

      const failedSteps = results.filter(r => r.error);
      if (!failedSteps.length) break;

      const nextCompleted = new Map(completedSteps);
      for (const r of results) {
        if (!r.error) nextCompleted.set(r.toolName, r);
      }
      completedSteps = nextCompleted;

      executionAttempt++;
      if (executionAttempt > MAX_EXECUTION_RETRIES) {
        logger.warn({ executionAttempt, failedSteps: failedSteps.map(r => ({ tool: r.toolName, error: r.error })) }, 'max execution retries reached');
        break;
      }

      const session = contextMemoryManager.getSession(sessionId || '');
      const referencedEntities = session?.lastReferencedEntities || {};

      const errorContext = failedSteps
        .map(r => makeActionableError(r.toolName, r.error || '', results, tools, referencedEntities))
        .join('\n');

      const successContext = [...completedSteps.entries()]
        .map(([name]) => `- ${name}: succeeded (do NOT repeat)`)
        .join('\n');

      logger.info(
        { executionAttempt, MAX_EXECUTION_RETRIES },
        `execution attempt ${executionAttempt} failed, replanning`
      );

      if (sessionId) contextMemoryManager.logEvent(sessionId, { event: 'execution_retry', attempt: executionAttempt, failedSteps: failedSteps.map(r => r.toolName) });

      try {

        // Generic: list all entity types currently in context
        const existingEntities = Object.keys(referencedEntities)
          .filter(k => k.startsWith('last') && k !== 'lastReferencedEntities')
          .map(k => {
            const entityType = k.replace(/^last/, '').toLowerCase();
            const value = referencedEntities[k]?.value;
            return `- ${entityType}: ${value}`;
          });

        const entityStateContext = existingEntities.length > 0
          ? `Entities currently available in this conversation:\n${existingEntities.join('\n')}`
          : `No entities have been created or referenced yet in this conversation.`;

        const replanMessage = [
          userMessage,
          successContext ? `\nSteps already completed successfully:\n${successContext}` : '',
          `\n${entityStateContext}`,
          `\nPrevious execution attempt failed:\n${errorContext}`,
          `\nReconsider the strategy. If the failed step depends on an entity that does ` +
          `not exist in the current context, you may need to CREATE it first.`,
        ].join('');

        if (sessionId && executionAttempt > 0) {
          contextMemoryManager.logReplanMessage(
            sessionId,
            executionAttempt,
            errorContext,
            successContext || '',
            replanMessage
          );
        }

        plan = await createOrRepairPlan(replanMessage, tools, settings, sessionId, baselineConfig);

        if (sessionId) {
          contextMemoryManager.logPlanCreated(
            sessionId,
            executionAttempt,
            plan.steps.length,
            plan.steps.map(s => s.toolName),
            plan.reasoning
          );
        }
      } catch (replanErr) {
        logger.warn({ replanErr }, 'replan after execution failure also failed, using last results');
        break;
      }
    }

    const messages: ChatCompletionMessageParam[] = [...conversationHistory, { role: 'user', content: userMessage }];

    const summary = results.map(r => `${r.toolName}: ${r.error || JSON.stringify(r.result).substring(0, 80)}`).join('\n');
    const finalResponse = await client.chat.completions.create({
      model: settings.llmModel,
      messages: [...conversationHistory, { role: 'user', content: userMessage }, { role: 'user', content: `Summary:\n${summary}` }],
      temperature: 0.3,
      max_tokens: 250,
    });

    const finalMessage = finalResponse.choices[0].message.content || 'Completed';

    return {
      plan,
      executionResults: results,
      executionTrace: trace,
      finalResponse: finalMessage,
      messages: [...messages, { role: 'assistant', content: finalMessage }],
    };
  } catch (error) {
    logger.error({ error }, 'orchestration failed');
    throw error;
  }
}
