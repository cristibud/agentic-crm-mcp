import type { TrialResult, ScenarioMetrics, AggregatedSummary } from './types.js';

export function aggregateScenarioMetrics(
  scenarioId: string,
  complexity: string,
  mode: 'system' | 'baseline',
  trials: TrialResult[]
): ScenarioMetrics {
  const n = trials.length;
  if (n === 0) {
    return { scenario_id: scenarioId, complexity, mode, n_trials: 0, pass_at_1: 0, pass_pow_3: 0, mean_tool_call_accuracy: 0, mean_token_cost: 0, mean_duration_ms: 0, mean_repair_iterations: 0, mean_retry_attempts: 0, mean_failed_executions: 0, intent_resolution_rate: 0, mean_n_replans_attempted: 0, mean_n_replans_with_strategy_change: 0 };
  }

  const successCount = trials.filter(t => t.overall_success).length;
  return {
    scenario_id: scenarioId,
    complexity,
    mode,
    n_trials: n,
    pass_at_1: successCount / n,
    pass_pow_3: trials.every(t => t.overall_success) ? 1 : 0,
    mean_tool_call_accuracy: trials.reduce((s, t) => s + t.tool_call_accuracy, 0) / n,
    mean_token_cost: trials.reduce((s, t) => s + t.total_tokens_input + t.total_tokens_output, 0) / n,
    mean_duration_ms: trials.reduce((s, t) => s + t.total_duration_ms, 0) / n,
    mean_repair_iterations: trials.reduce((s, t) => s + t.n_repair_iterations, 0) / n,
    mean_retry_attempts: trials.reduce((s, t) => s + t.n_retry_attempts, 0) / n,
    mean_failed_executions: trials.reduce((s, t) => s + t.n_failed_executions, 0) / n,
    intent_resolution_rate: trials.filter(t => t.intent_resolution).length / n,
    mean_n_replans_attempted: trials.reduce((s, t) => s + t.n_replans_attempted, 0) / n,
    mean_n_replans_with_strategy_change: trials.reduce((s, t) => s + t.n_replans_with_strategy_change, 0) / n,
  };
}

export function aggregateSummary(scenarios: ScenarioMetrics[]): AggregatedSummary {
  const n = scenarios.length;
  if (n === 0) {
    return { overall_pass_at_1: 0, overall_pass_pow_3: 0, overall_tool_call_accuracy: 0, mean_token_cost: 0, mean_repair_iterations: 0, mean_retry_attempts: 0 };
  }
  return {
    overall_pass_at_1: scenarios.reduce((s, sc) => s + sc.pass_at_1, 0) / n,
    overall_pass_pow_3: scenarios.reduce((s, sc) => s + sc.pass_pow_3, 0) / n,
    overall_tool_call_accuracy: scenarios.reduce((s, sc) => s + sc.mean_tool_call_accuracy, 0) / n,
    mean_token_cost: scenarios.reduce((s, sc) => s + sc.mean_token_cost, 0) / n,
    mean_repair_iterations: scenarios.reduce((s, sc) => s + sc.mean_repair_iterations, 0) / n,
    mean_retry_attempts: scenarios.reduce((s, sc) => s + sc.mean_retry_attempts, 0) / n,
  };
}

export function computeImprovements(
  system: AggregatedSummary,
  baseline: AggregatedSummary
): Record<string, string> {
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  return {
    delta_pass_at_1: fmt(system.overall_pass_at_1 - baseline.overall_pass_at_1),
    delta_pass_pow_3: fmt(system.overall_pass_pow_3 - baseline.overall_pass_pow_3),
    delta_tool_call_accuracy: fmt(system.overall_tool_call_accuracy - baseline.overall_tool_call_accuracy),
    delta_token_cost: baseline.mean_token_cost > 0
      ? fmt((system.mean_token_cost - baseline.mean_token_cost) / baseline.mean_token_cost)
      : 'N/A',
    delta_repair_iterations: fmt(system.mean_repair_iterations - baseline.mean_repair_iterations),
    delta_retry_attempts: fmt(system.mean_retry_attempts - baseline.mean_retry_attempts),
  };
}
