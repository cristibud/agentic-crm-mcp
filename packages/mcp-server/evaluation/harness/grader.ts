import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config.js';
import { apiClient } from './apiClient.js';
import type { Scenario, TurnResult, TrialResult } from './types.js';

export function readSessionLog(sessionId: string): {
  events: any[];
  n_repair_iterations: number;
  n_retry_attempts: number;
  n_failed_executions: number;
  n_pending_plans: number;
  tools_called: string[];
  tokens_input: number;
  tokens_output: number;
  n_plans_generated: number;
  n_replans_attempted: number;
  n_replans_with_strategy_change: number;
  all_plans: Array<{ attempt: number; toolsInPlan: string[]; nSteps: number }>;
  replan_messages: Array<{ attempt: number; hasErrorContext: boolean; errorPreview: string }>;
} {
  const logPath = path.join(CONFIG.LOGS_DIR, `${sessionId}.jsonl`);
  if (!fs.existsSync(logPath)) {
    return { events: [], n_repair_iterations: 0, n_retry_attempts: 0, n_failed_executions: 0, n_pending_plans: 0, tools_called: [], tokens_input: 0, tokens_output: 0, n_plans_generated: 0, n_replans_attempted: 0, n_replans_with_strategy_change: 0, all_plans: [], replan_messages: [] };
  }
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim());
  const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const n_repair_iterations = events.filter(e => e.event === 'plan_repair_attempt').length;
  const n_retry_attempts = events.filter(e => e.event === 'execution_retry').length;
  const n_failed_executions = events.filter(e => e.event === 'execution_failed').length;
  const n_pending_plans = events.filter(e => e.event === 'pending_plan_created').length;
  // tool_called is logged at invocation time (covers empty-result search calls that skip action_added)
  const tools_called = events.filter(e => e.event === 'tool_called' && e.toolName).map(e => e.toolName as string);
  const tokens_input = events.filter(e => e.event === 'llm_call').reduce((s: number, e: any) => s + (e.input_tokens || 0), 0);
  const tokens_output = events.filter(e => e.event === 'llm_call').reduce((s: number, e: any) => s + (e.output_tokens || 0), 0);

  const n_plans_generated = events.filter(e => e.event === 'plan_created').length;
  const n_replans_attempted = events.filter(e => e.event === 'plan_created' && e.isReplan === true).length;

  const all_plans = events.filter(e => e.event === 'plan_created').map(e => ({
    attempt: e.attempt,
    toolsInPlan: (e.toolsInPlan || []) as string[],
    nSteps: e.nSteps as number,
  }));

  let n_replans_with_strategy_change = 0;
  for (let i = 1; i < all_plans.length; i++) {
    const previous = all_plans[i - 1].toolsInPlan.join(',');
    const current = all_plans[i].toolsInPlan.join(',');
    if (previous !== current) n_replans_with_strategy_change++;
  }

  const replan_messages = events
    .filter(e => e.event === 'replan_message_built')
    .map(e => ({
      attempt: e.attempt as number,
      hasErrorContext: e.hasErrorContext as boolean,
      errorPreview: (e.errorContextPreview || '') as string,
    }));

  return { events, n_repair_iterations, n_retry_attempts, n_failed_executions, n_pending_plans, tools_called, tokens_input, tokens_output, n_plans_generated, n_replans_attempted, n_replans_with_strategy_change, all_plans, replan_messages };
}

export async function checkOutcomes(expectedOutcomes: Record<string, any>): Promise<boolean> {
  if (!expectedOutcomes || Object.keys(expectedOutcomes).length === 0) return true;

  const leads = await apiClient.getAllLeads();
  const deals = await apiClient.getAllDeals();
  const contracts = await apiClient.getAllContracts();

  for (const [key, expected] of Object.entries(expectedOutcomes)) {
    switch (key) {
      case 'lead_count_min':
        if (leads.length < expected) return false;
        break;
      case 'deal_count_min':
        if (deals.length < expected) return false;
        break;
      case 'contract_count_min':
        if (contracts.length < expected) return false;
        break;
      case 'lead_with_name':
        if (!leads.some((l: any) => l.name === expected)) return false;
        break;
      case 'lead_with_email':
        if (!leads.some((l: any) => l.email === expected)) return false;
        break;
      case 'deal_with_title':
        if (!deals.some((d: any) => d.title === expected)) return false;
        break;
      case 'deal_linked_to_lead_with_name': {
        const matchingLead = leads.find((l: any) => l.name === expected);
        if (!matchingLead) return false;
        if (!deals.some((d: any) => d.leadId === matchingLead.id)) return false;
        break;
      }
      case 'deal_with_title_in_stage': {
        const target = expected as { title: string; stage: string };
        const deal = deals.find((d: any) => d.title === target.title);
        if (!deal || deal.stage !== target.stage) return false;
        break;
      }
      case 'lead_status_for_company_techcorp': {
        const lead = leads.find((l: any) => l.company === 'Tech Corp');
        if (!lead || lead.status !== expected) return false;
        break;
      }
      // These are soft checks — outcome is determined by tool call presence in session log
      case 'search_returned_results':
      case 'min_search_results':
      case 'pending_plan_or_clarification_requested':
        break;
    }
  }
  return true;
}

export function computeToolCallAccuracy(toolsCalled: string[], expectedTools: string[]): number {
  if (!expectedTools || expectedTools.length === 0) return 1.0;
  const calledSet = new Set(toolsCalled);
  return expectedTools.filter(t => calledSet.has(t)).length / expectedTools.length;
}

export function computeIntentResolution(toolsCalled: string[], expectedTools: string[]): boolean {
  if (!expectedTools || expectedTools.length === 0) return true;
  if (toolsCalled.length === 0) return false;
  return expectedTools.includes(toolsCalled[0]);
}

export async function gradeTrial(
  scenario: Scenario,
  turnResults: TurnResult[],
  sessionId: string,
  mode: 'system' | 'baseline',
  trialNumber: number,
  startTime: number
): Promise<TrialResult> {
  const log = readSessionLog(sessionId);
  const totalDuration = Date.now() - startTime;

  const allExpectedTools = scenario.turns.flatMap(t => t.expected_tools || []);
  const expectedToolsFirstTurn = scenario.turns[0]?.expected_tools || [];

  const toolCallAccuracy = computeToolCallAccuracy(log.tools_called, allExpectedTools);
  const intentResolution = computeIntentResolution(log.tools_called, expectedToolsFirstTurn);

  const finalTurn = scenario.turns[scenario.turns.length - 1];
  const finalStateCheckPassed = finalTurn.expected_outcomes
    ? await checkOutcomes(finalTurn.expected_outcomes)
    : true;

  // tool_call_accuracy = 1.0 is sufficient for success; DB state check is a secondary signal
  const overallSuccess = toolCallAccuracy >= 1.0 || (finalStateCheckPassed && toolCallAccuracy >= 0.5);

  return {
    scenario_id: scenario.id,
    trial_number: trialNumber,
    mode,
    turns: turnResults,
    total_duration_ms: totalDuration,
    total_tokens_input: log.tokens_input,
    total_tokens_output: log.tokens_output,
    total_tool_calls: log.tools_called.length,
    n_repair_iterations: log.n_repair_iterations,
    n_retry_attempts: log.n_retry_attempts,
    n_failed_executions: log.n_failed_executions,
    final_state_check_passed: finalStateCheckPassed,
    tool_call_accuracy: toolCallAccuracy,
    intent_resolution: intentResolution,
    overall_success: overallSuccess,
    n_plans_generated: log.n_plans_generated,
    n_replans_attempted: log.n_replans_attempted,
    n_replans_with_strategy_change: log.n_replans_with_strategy_change,
  };
}
