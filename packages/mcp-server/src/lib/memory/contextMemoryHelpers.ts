// Entity extraction
export function extractEntities(text: string): Record<string, string> {
  const entities: Record<string, string> = {};

  // Email pattern
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) entities.email = emailMatch[1];

  // Phone pattern — requires separators to avoid matching plain amounts
  const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,14}\d)(?!\s*(?:%|\w))/i);
  if (phoneMatch && /[\s\-()]/.test(phoneMatch[1])) entities.phone = phoneMatch[1].trim();

  // Amount: prefer explicit currency suffix, fall back to bare number (≥4 digits) not followed by %
  const currencyMatch = text.match(/(\d[\d.,]*)\s*(lei|eur|usd|ron|gbp|€|\$|£)/i);
  if (currencyMatch) {
    entities.amount = currencyMatch[1];
  } else {
    const bareNumberMatch = text.match(/\b(\d{4,}(?:[.,]\d+)?)\b(?!\s*%)/);
    if (bareNumberMatch) entities.amount = bareNumberMatch[1];
  }

  // Percentage patterns
  const percentMatch = text.match(/(\d+)\s*%/);
  if (percentMatch) entities.percentage = percentMatch[1];

  // Names — two or more consecutive Title Case words (language-agnostic proper noun heuristic)
  const nameMatches = text.match(/\b([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ][a-zàáâãäåèéêëìíîïòóôõöùúûü]+ [A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ][a-zàáâãäåèéêëìíîïòóôõöùúûü]+(?:\s+[A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ][a-zàáâãäåèéêëìíîïòóôõöùúûü]+)*)\b/g);
  if (nameMatches && nameMatches.length > 0) {
    entities.names = nameMatches.join(', ');
    entities.lastMentionedName = nameMatches[0];
  }

  return entities;
}

export function generateActionDescription(toolName: string, result: unknown, resultCount: number): string {
  // Extract verb and noun from tool name: create_lead → "create", "lead"
  const parts = toolName.split('_');
  const verb = parts[0]; // create, update, move, search, generate, get
  const entity = parts.slice(1).join('_') || 'item'; // lead, deal, stage, contract

  // Humanize: convert snake_case to Title Case
  const entityLabel = entity
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const resultObj = result as Record<string, any>;

  // Generic action patterns based on verb
  switch (verb) {
    case 'search':
      return `Searched for ${entityLabel} - found ${resultCount} result${resultCount !== 1 ? 's' : ''}`;
    case 'create':
      return `Created new ${entityLabel}`;
    case 'update':
      return `Updated ${entityLabel}`;
    case 'move':
      return `Moved ${entityLabel} to ${resultObj?.stage || resultObj?.newStage || 'new stage'}`;
    case 'generate':
      return `Generated ${entityLabel}`;
    case 'get':
      return `Retrieved ${entityLabel}`;
    case 'delete':
      return `Deleted ${entityLabel}`;
    default:
      return `Executed ${toolName} - ${resultCount} result${resultCount !== 1 ? 's' : ''}`;
  }
}

// Format context summary
export function formatContextSummary(
  conversationHistory: string,
  actionHistory: string,
  extractedEntities: string,
  createdEntities: string,
  failedAttempts?: string,
  entityFieldHints?: string,
  entityIndexSummary?: string
): string {
  const idMappingSection = entityFieldHints
    ? `4. **ID FIELD MAPPING** - Use the right ID parameter for each operation:\n${entityFieldHints}`
    : `4. **ID FIELD MAPPING** - Look up the entity type in ENTITIES CREATED and map it to the correct ID parameter name for each tool`;

  return `
CONVERSATION CONTEXT (Last 20 messages):
${conversationHistory}

EXECUTION HISTORY (What has been done successfully):
${actionHistory ? actionHistory : '(No actions yet)'}

${failedAttempts ? `FAILED ATTEMPTS (DO NOT repeat these exact calls — fix the approach):
${failedAttempts}
` : ''}
EXTRACTED ENTITIES FROM CONVERSATION:
${extractedEntities || '(No entities extracted yet)'}

ENTITIES CREATED IN PREVIOUS STEPS (with IDs) - USE THESE FOR IMPLICIT REFERENCES:
${createdEntities ? createdEntities : '(No entities created yet)'}

ENTITY NAME INDEX (name → ID — use this to resolve "update John's X" without searching):
${entityIndexSummary || '(no entities indexed yet)'}

CRITICAL INSTRUCTIONS FOR USING CONTEXT:

1. **IMPLICIT REFERENCES** - When user says "it", "him", "that", or references something without naming it explicitly:
   - Look at EXECUTION HISTORY to understand what was just done
   - Find the corresponding ID in "ENTITIES CREATED" section
   - Use that ID directly — do NOT search again for something you just created or retrieved

2. **NAME RESOLUTION** - When user mentions an entity by name (e.g. "update John's lead"):
   - Check ENTITY NAME INDEX first — if the name is there, use that ID directly
   - Only search if the name is NOT in the index

3. **DON'T OVER-SEARCH** - Avoid redundant searches:
   - If an entity's ID already exists in ENTITIES CREATED or ENTITY NAME INDEX, use it directly
   - Only search if you genuinely do not have the ID and cannot infer it from context

4. **LEARN FROM FAILURES** - If FAILED ATTEMPTS section is not empty:
   - Do NOT retry with the same tool + same parameters
   - Choose a different approach or correct the parameters

${idMappingSection}

6. **MULTI-STEP ACTIONS** - When operating on something that must first be found:
   - Step 1: Search for the entity ONLY if its ID is not in ENTITY NAME INDEX or ENTITIES CREATED
   - Step 2: Create/update/move using the found or context-provided ID
   - Don't search twice for the same entity in the same plan!`;
}
