export interface PlanStep {
  order: number;
  toolName: string;
  description: string;
  dependencies: number[];
  stepInputs?: Record<string, unknown>;
}

export interface ExecutionPlan {
  steps: PlanStep[];
  reasoning: string;
}

export interface PendingPlanState {
  plan: ExecutionPlan;
  missingParams: Array<{
    name: string;
    type?: string;
    description?: string;
  }>;
  toolName: string;
}

export interface ParameterExtractionResult {
  completedPlan: ExecutionPlan | null;
  extractedParams: Record<string, string>;
  missingParams: Array<{
    name: string;
    type?: string;
    description?: string;
  }>;
}
