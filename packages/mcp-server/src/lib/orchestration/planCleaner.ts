import type { ExecutionPlan } from '../../types/Planning.js';

export function cleanPlanStepInputs(plan: ExecutionPlan): void {
  for (const step of plan.steps) {
    if (!step.stepInputs) continue;

    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(step.stepInputs)) {
      // Omit empty strings, null, undefined
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        continue;
      }

      // Keep placeholder references like "<from step N>"
      if (typeof value === 'string' && value.startsWith('<') && value.endsWith('>')) {
        cleaned[key] = value;
        continue;
      }

      // Keep all other values (normalization happens later)
      cleaned[key] = value;
    }

    step.stepInputs = cleaned;
  }
}
