export interface BaselineConfig {
  disablePlanValidation: boolean;
  disablePlanRepair: boolean;
  disableExecutionRetry: boolean;
}

export const DEFAULT_BASELINE_CONFIG: BaselineConfig = {
  disablePlanValidation: false,
  disablePlanRepair: false,
  disableExecutionRetry: false,
};

export const FULL_BASELINE_CONFIG: BaselineConfig = {
  disablePlanValidation: true,
  disablePlanRepair: true,
  disableExecutionRetry: true,
};

export function getBaselineConfigFromEnv(): BaselineConfig {
  return {
    disablePlanValidation: process.env.DISABLE_PLAN_VALIDATION === 'true',
    disablePlanRepair: process.env.DISABLE_PLAN_REPAIR === 'true',
    disableExecutionRetry: process.env.DISABLE_EXECUTION_RETRY === 'true',
  };
}
