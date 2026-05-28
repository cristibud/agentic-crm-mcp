export const CONFIG = {
  API_URL: process.env.EVAL_API_URL || 'http://localhost:3001',
  MCP_URL: process.env.EVAL_MCP_URL || 'http://localhost:3002',
  API_KEY: process.env.EVAL_API_KEY || 'crm-secret-key-2024',
  N_TRIALS_PER_SCENARIO: parseInt(process.env.EVAL_N_TRIALS || '3', 10),
  LOGS_DIR: process.env.EVAL_LOGS_DIR || './logs/context-memory',
  RESULTS_DIR: './evaluation/results',
  SCENARIOS_DIR: './evaluation/scenarios',
  WAIT_BETWEEN_TURNS_MS: 1000,
  TURN_TIMEOUT_MS: 60000,
};
