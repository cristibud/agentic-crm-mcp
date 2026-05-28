export interface Scenario {
  id: string;
  complexity: 'simple' | 'medium' | 'complex';
  description: string;
  preconditions: {
    seed_leads?: Array<{
      name: string;
      email: string;
      phone?: string;
      company?: string;
      source: string;
    }>;
  };
  turns: Turn[];
}

export interface Turn {
  turn_id: number;
  user_message: string;
  expected_tools?: string[];
  expected_outcomes?: Record<string, any>;
}

export interface TrialResult {
  scenario_id: string;
  trial_number: number;
  mode: 'system' | 'baseline';
  turns: TurnResult[];
  total_duration_ms: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_tool_calls: number;
  n_repair_iterations: number;
  n_retry_attempts: number;
  n_failed_executions: number;
  final_state_check_passed: boolean;
  tool_call_accuracy: number;
  intent_resolution: boolean;
  overall_success: boolean;
  error?: string;
  n_plans_generated: number;
  n_replans_attempted: number;
  n_replans_with_strategy_change: number;
}

export interface TurnResult {
  turn_id: number;
  user_message: string;
  assistant_response: string;
  tools_called: string[];
  duration_ms: number;
  error?: string;
}

export interface ScenarioMetrics {
  scenario_id: string;
  complexity: string;
  mode: 'system' | 'baseline';
  n_trials: number;
  pass_at_1: number;
  pass_pow_3: number;
  mean_tool_call_accuracy: number;
  mean_token_cost: number;
  mean_duration_ms: number;
  mean_repair_iterations: number;
  mean_retry_attempts: number;
  mean_failed_executions: number;
  intent_resolution_rate: number;
  mean_n_replans_attempted: number;
  mean_n_replans_with_strategy_change: number;
}

export interface FinalReport {
  metadata: {
    timestamp: string;
    model: string;
    n_scenarios: number;
    n_trials_per_scenario: number;
    total_runs: number;
  };
  scenario_results: {
    system: ScenarioMetrics[];
    baseline: ScenarioMetrics[];
  };
  summary: {
    system: AggregatedSummary;
    baseline: AggregatedSummary;
    improvements: Record<string, string>;
  };
}

export interface AggregatedSummary {
  overall_pass_at_1: number;
  overall_pass_pow_3: number;
  overall_tool_call_accuracy: number;
  mean_token_cost: number;
  mean_repair_iterations: number;
  mean_retry_attempts: number;
}
