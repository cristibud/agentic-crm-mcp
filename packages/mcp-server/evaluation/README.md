# MCP-CRM Evaluation Harness

Automated evaluation harness for the agentic CRM system. Validates three design hypotheses:
- **H1**: Pre-validation + step-by-step execution gating reduces error rate vs. direct execution
- **H2**: Plan repair + retry with completed steps preservation reduces cost and avoids duplicate side effects
- **H3**: Persistent memory layer enables successful context switching in multi-turn conversations

## Setup

1. Ensure all three services are running:
   ```bash
   # PostgreSQL on port 5432
   cd packages/api && npm run dev      # port 3001
   cd packages/mcp-server && npm run dev  # port 3002
   ```

## Running

```bash
cd packages/mcp-server

# Full evaluation (system + baseline in one run — no server restart needed)
npm run eval:full

# System mode only
npm run eval:system

# Baseline mode only (mechanisms disabled per-request)
npm run eval:baseline
```

Baseline mode is activated per-request via `?baseline=true` — the same running server handles both system and baseline runs without restart.

## Scenarios

| ID | Complexity | Description |
|---|---|---|
| scenario_01 | simple | Create a single lead |
| scenario_02 | simple | Search leads by partial name |
| scenario_03 | medium | Create lead + deal in sequence |
| scenario_04 | medium | Pending plan with parameter completion |
| scenario_05 | complex | Full sales pipeline (lead → deal → contract) |
| scenario_06 | complex | Context switching between two named entities |

Each scenario is run `N_TRIALS_PER_SCENARIO` times (default: 3) per mode.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `EVAL_API_URL` | `http://localhost:3001` | REST API base URL |
| `EVAL_MCP_URL` | `http://localhost:3002` | MCP server base URL |
| `EVAL_API_KEY` | `crm-secret-key-2026` | API auth key |
| `EVAL_N_TRIALS` | `3` | Trials per scenario |
| `EVAL_LOGS_DIR` | `./logs/context-memory` | Path to MCP session JSONL logs |

## Metrics

- **pass@1** — probability of success on the first try
- **pass^3** — all 3 trials succeed (consistency)
- **tool_call_accuracy** — fraction of expected tools actually called
- **intent_resolution_rate** — first tool call matches expected first tool
- **mean_repair_iterations** — average plan repair iterations per scenario
- **mean_retry_attempts** — average execution retries per scenario
- **mean_token_cost** — average tokens consumed (requires `llm_call` events in logs)

## Output

Results written to `evaluation/results/final_report_<timestamp>.json`:
```json
{
  "metadata": { ... },
  "scenario_results": { "system": [...], "baseline": [...] },
  "summary": {
    "system": { "overall_pass_at_1": 0.83, ... },
    "baseline": { "overall_pass_at_1": 0.45, ... },
    "improvements": { "delta_pass_at_1": "+38.0%", ... }
  }
}
```
