import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CONFIG } from './config.js';
import { apiClient } from './apiClient.js';
import { gradeTrial } from './grader.js';
import { aggregateScenarioMetrics, aggregateSummary, computeImprovements } from './metrics.js';
import type { Scenario, TrialResult, TurnResult, ScenarioMetrics, FinalReport } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadScenarios(): Scenario[] {
  const dir = CONFIG.SCENARIOS_DIR;
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Scenario);
}

async function runOneTrial(
  scenario: Scenario,
  mode: 'system' | 'baseline',
  trialNumber: number
): Promise<TrialResult> {
  const sessionId = `eval-${scenario.id}-${mode}-t${trialNumber}-${randomUUID().substring(0, 8)}`;
  const startTime = Date.now();
  const isBaseline = mode === 'baseline';

  console.log(`\n  [Trial ${trialNumber}] ${mode.toUpperCase()} | session: ${sessionId}`);

  await apiClient.resetDatabase();

  for (const lead of scenario.preconditions.seed_leads || []) {
    await apiClient.seedLead(lead);
  }

  await apiClient.resetMCPSession(sessionId);

  const turnResults: TurnResult[] = [];

  for (const turn of scenario.turns) {
    const label = turn.user_message.length > 57 ? turn.user_message.substring(0, 57) + '...' : turn.user_message;
    console.log(`    Turn ${turn.turn_id}: "${label}"`);
    const turnStart = Date.now();

    let response: any = { response: '', toolCalls: [] };
    let error: string | undefined;
    try {
      response = await apiClient.sendMessageToMCP(sessionId, turn.user_message, isBaseline);
    } catch (e: any) {
      error = e.message || String(e);
    }

    turnResults.push({
      turn_id: turn.turn_id,
      user_message: turn.user_message,
      assistant_response: response.response || JSON.stringify(response).substring(0, 200),
      tools_called: (response.toolCalls || []).map((tc: any) => tc.name ?? tc),
      duration_ms: Date.now() - turnStart,
      error,
    });

    await sleep(CONFIG.WAIT_BETWEEN_TURNS_MS);
  }

  const trialResult = await gradeTrial(scenario, turnResults, sessionId, mode, trialNumber, startTime);
  console.log(`    -> success: ${trialResult.overall_success}, tool_accuracy: ${trialResult.tool_call_accuracy.toFixed(2)}, replans: ${trialResult.n_replans_attempted} (strategy_changes: ${trialResult.n_replans_with_strategy_change}), retries: ${trialResult.n_retry_attempts}`);
  await apiClient.resetDatabase();
  return trialResult;
}

async function runScenarioAllTrials(scenario: Scenario, mode: 'system' | 'baseline'): Promise<TrialResult[]> {
  console.log(`\nScenario: ${scenario.id} (${scenario.complexity}) — mode: ${mode}`);
  const trials: TrialResult[] = [];
  for (let i = 1; i <= CONFIG.N_TRIALS_PER_SCENARIO; i++) {
    trials.push(await runOneTrial(scenario, mode, i));
  }
  return trials;
}

async function runAllScenarios(mode: 'system' | 'baseline'): Promise<ScenarioMetrics[]> {
  console.log(`\nMODE: ${mode.toUpperCase()}`);
  const scenarios = loadScenarios();
  const allMetrics: ScenarioMetrics[] = [];
  for (const scenario of scenarios) {
    const trials = await runScenarioAllTrials(scenario, mode);
    allMetrics.push(aggregateScenarioMetrics(scenario.id, scenario.complexity, mode, trials));
  }
  return allMetrics;
}

async function main() {
  if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  }

  console.log('MCP-CRM Evaluation Harness');
  console.log(`Trials per scenario : ${CONFIG.N_TRIALS_PER_SCENARIO}`);
  console.log(`API                 : ${CONFIG.API_URL}`);
  console.log(`MCP                 : ${CONFIG.MCP_URL}`);
  console.log('Baseline mode       : per-request (?baseline=true) — no server restart needed');

  const mode = process.argv[2] as 'system' | 'baseline' | 'both' || 'both';

  let systemMetrics: ScenarioMetrics[] = [];
  let baselineMetrics: ScenarioMetrics[] = [];

  if (mode === 'system' || mode === 'both') {
    systemMetrics = await runAllScenarios('system');
  }

  if (mode === 'baseline' || mode === 'both') {
    baselineMetrics = await runAllScenarios('baseline');
  }

  const systemSummary = aggregateSummary(systemMetrics);
  const baselineSummary = aggregateSummary(baselineMetrics);
  const improvements = computeImprovements(systemSummary, baselineSummary);

  const report: FinalReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      model: 'openai/gpt-4o-mini',
      n_scenarios: Math.max(systemMetrics.length, baselineMetrics.length),
      n_trials_per_scenario: CONFIG.N_TRIALS_PER_SCENARIO,
      total_runs: (systemMetrics.length + baselineMetrics.length) * CONFIG.N_TRIALS_PER_SCENARIO,
    },
    scenario_results: { system: systemMetrics, baseline: baselineMetrics },
    summary: { system: systemSummary, baseline: baselineSummary, improvements },
  };

  const reportPath = path.join(CONFIG.RESULTS_DIR, `final_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log(' FINAL REPORT');
  console.log('='.repeat(80));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
