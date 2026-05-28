// Orchestration layer
export { orchestrateTools } from './orchestration/index.js';
export { createExecutionPlan } from './orchestration/index.js';
export type { ExecutionTrace, OrchestrationResult } from './orchestration/index.js';
export type { ExecutionPlan } from './orchestration/index.js';

// Validation layer
export { validatePlan, detectMissingParameters, fillMissingParamsFromContext } from './validation/index.js';
export type { ValidationError, MissingParametersInfo } from './validation/index.js';

// Extraction layer
export { extractAndCompletePlan, extractIds, flattenIds, normalizeToolInputs, mapIdsForTool } from './extraction/index.js';
export type { ParameterExtractionResult } from './extraction/index.js';

// Memory layer
export { ContextMemoryManager, contextMemoryManager, extractEntities, generateActionDescription, formatContextSummary } from './memory/index.js';
export type { ConversationMessage, ActionHistoryEntry } from './memory/index.js';

// Core/LLM layer
export { handleUserMessage, executeToolsAndRespond } from './core/index.js';

// Core types
export type { Settings, ToolDefinition, ToolCall } from './types/index.js';

// Utilities
export { logger } from './logger.js';
export { apiClient } from './apiClient.js';
