export interface ValidationError {
  step: number;
  toolName: string;
  issue: string;
}

export interface MissingParametersInfo {
  hasMissing: boolean;
  toolName: string;
  missingParams: Array<{
    name: string;
    type?: string;
    description?: string;
  }>;
}
