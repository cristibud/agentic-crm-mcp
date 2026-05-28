import OpenAI from 'openai';
import { logger } from '../logger.js';
import type { Settings, ToolDefinition } from '../types/types.js';

export interface PlanStep {
  order: number;
  toolName: string;
  description: string;
  dependencies: number[]; // indices of steps that must run before this one
  stepInputs?: Record<string, unknown>; // Parameters/data for this step (merged with mapped IDs)
}

export interface ExecutionPlan {
  steps: PlanStep[];
  reasoning: string;
}

export async function createExecutionPlan(
  userMessage: string,
  tools: ToolDefinition[],
  settings: Settings,
  contextSummary?: string, // Optional context from previous messages
): Promise<ExecutionPlan> {
  const client = new OpenAI({
    apiKey: settings.llmApiKey,
    baseURL: settings.llmBaseUrl,
  });

  // Build detailed tool specifications
  const toolSpecifications = tools
    .map((t) => {
      const params = Object.entries(t.parameters.properties)
        .map(([name, prop]: [string, any]) => {
          let paramDesc = `      - ${name}: (${prop.type || 'string'}`;
          if (prop.enum) paramDesc += ` enum=[${prop.enum.join(', ')}]`;
          if (prop.description) paramDesc += ` - ${prop.description}`;
          paramDesc += ')';
          return paramDesc;
        })
        .join('\n');

      let spec = `${t.name} [${t.category || 'other'}]
    Description: ${t.description}
    Parameters:
${params}`;

      if (t.idFields && t.idFields.length > 0) {
        spec += `\n    REQUIRES IDs: ${t.idFields.join(', ')} (MUST be provided or obtained from previous step IDs)`;
      }
      if (t.outputFields && t.outputFields.length > 0) {
        spec += `\n    OUTPUTS: ${t.outputFields.join(', ')} (these are available to subsequent steps)`;
      }

      return spec;
    })
    .join('\n\n');

  const toolSummary = tools
    .map((t) => {
      let desc = `- ${t.name}: ${t.description}\n  params: ${Object.keys(t.parameters.properties).join(', ')}`;
      
      // Add ID requirements and outputs
      if (t.idFields && t.idFields.length > 0) {
        desc += `\n  requires IDs: [${t.idFields.join(', ')}]`;
      }
      if (t.outputFields && t.outputFields.length > 0) {
        desc += `\n  outputs IDs: [${t.outputFields.join(', ')}]`;
      }
      
      // Add enum constraints if any parameters have enum values
      const enumParams = Object.entries(t.parameters.properties)
        .filter(([_, prop]: [string, any]) => prop.enum)
        .map(([paramName, prop]: [string, any]) => `    ${paramName}: [${prop.enum.join(', ')}]`);
      
      if (enumParams.length > 0) {
        desc += '\n  enums:\n' + enumParams.join('\n');
      }
      
      return desc;
    })
    .join('\n');


  const planningPrompt = `You are a generic task planner for a system with multiple tools. Your job is to create an execution plan that chains tools together based on user request.

TOOL SPECIFICATIONS (COMPLETE PARAMETER LIST):

${toolSpecifications}

QUICK REFERENCE (TOOL SUMMARY):

Available tools:
${toolSummary}

User request: "${userMessage}"

${contextSummary ? `\nCONVERSATION HISTORY & CONTEXT:\n${contextSummary}\n\nUse the conversation history to understand references to previous entities or actions.` : ''}

PLANNING ALGORITHM:

STEP 1: IDENTIFY THE FINAL GOAL
   - What action does the user want to perform?
   - Which tool executes that action?
   - What parameters does that tool require?

STEP 2: ANALYZE EACH REQUIRED PARAMETER
   For each required parameter of the final action tool:
   
   a) USER PROVIDED SEARCH TERMS / TEXT DESCRIPTION:
      - Signs: natural language string, names, descriptions (contain spaces, mixed case)
      - User intent: find/lookup something, not provide an explicit ID
      - Action: Find a search/lookup tool that accepts this parameter
        * These tools typically have "query" or search parameters
        * They return IDs that can feed into next steps
      - Example: user says "update item for customer John" 
        → not an ID, it's a customer name
        → use search/lookup tool with query="John" → get customer ID → use in update

   b) USER PROVIDED AN EXPLICIT ID:
      - Signs: hex strings, UUID format, numeric IDs, alphanumeric codes
      - Action: Use directly in stepInputs, but NOT as explicit values - let system map them

   c) USER PROVIDED VALUES FOR NON-ID PARAMETERS:
      - Non-ID parameters: enum values, numbers, booleans, descriptions, status values
      - Example: "set priority to High" → "High" is an enum value
      - Use directly in stepInputs with exact value

   d) MISSING REQUIRED ID NOT PROVIDED BY USER:
      - Tool needs an ID marked in "requires IDs"
      - User described something by name/text, not ID
      - User context suggests a parent resource needed for filtering
      - Solution: Add a lookup step that produces that ID
      - Then chain it to current tool
      - Example: User says "archive order for customer Alice"
        * Final tool: archive_order (requires: customer_id)
        * User gave: customer name "Alice", not customer_id
        * Solution chain: search_customers(query="Alice") → get customer_id → archive_order(customer_id)

STEP 3: BUILD EXECUTION SEQUENCE
   - Order steps so dependencies are satisfied
   - Each step can only depend on previous steps that output needed IDs
   - Earliest steps have no dependencies
   - No circular dependencies

STEP 4: EXTRACT PARAMETER VALUES
   - For each step, collect parameters from user request
   - Include only non-ID parameters in stepInputs
   - ID parameters are filled automatically by system
   - Use exact enum values (case-sensitive)

CRITICAL RULES:

1. PARAMETER VALIDATION (CRITICAL - CHECK TOOL SPECIFICATIONS):
   - BEFORE adding a parameter to stepInputs, verify it exists in tool's parameter list
   - Read from "TOOL SPECIFICATIONS" section above which shows ALL accepted parameters
   - NEVER invent parameters that tool doesn't accept
   - NEVER use "query" for a tool that doesn't have "query" parameter
   - Example: search_deals accepts [leadId, stage, minValue, maxValue, minProbability, maxProbability]
      → search_deals DOES NOT accept "query" parameter
      → If user says "search for deals for John Doe", you MUST:
         1. First search_leads(query="John Doe") to find lead ID
         2. Then search_deals(leadId=<from step 1>)

2. QUERY/SEARCH DETECTION:
   - If user describes entity/resource BY NAME or TEXT: add lookup step
   - Any "search", "find", "lookup" operation with query parameters provides IDs for downstream tools
   - Do not skip this if "optional" — check the required IDs field

3. PARENT RESOURCE CHAINS:
   - If tool marks "requires IDs", those are usually needed for proper operation
   - Even if marked optional, they often represent filtering by parent resource
   - When user describes child resource by name (not parent ID):
     * User context indicates a parent resource is needed
     * Add lookup step for parent resource
     * Chain it to the main operation
   - Example: "move task TaskName to board BoardName"
     * Tool move_task requires: board_id
     * User gave: board name "BoardName", not board_id
     * Solution: lookup_board(query="BoardName") → get board_id → move_task(board_id)

3. ID FIELD EXCLUSION (CRITICAL):
   - NEVER include ID field names or values in stepInputs
   - Any parameter ending in "id" or "Id" is handled by system
   - System automatically maps IDs from previous steps
   - Your stepInputs should ONLY have non-ID business parameters
   
   WRONG:
   BAD: "stepInputs": { "user_id": "12345", "title": "Task" }
   BAD: "stepInputs": { "parent_id": "<from previous step>" }
   BAD: "stepInputs": { "resource_id": "will_be_filled" }

   CORRECT:
   GOOD: "stepInputs": { "title": "Task", "priority": "High" } (NO IDs)
   GOOD: "stepInputs": { "query": "John" } (search steps ok)
   GOOD: "stepInputs": { "status": "completed" } (for update/change steps)

4. ENUM AND DEFAULT VALUES:
   - Use exact enum values from tool definition
   - If user doesn't specify enum value but tool requires it, infer most reasonable default
   - Check which enum values exist before choosing

5. REUSING PREVIOUS ENTITIES:
   - User may reference recently created/found entities with pronouns: "it", "that", "this"
   - Or by generic type: "the item", "the record", "move it"
   - Check ENTITIES CREATED IN PREVIOUS STEPS in conversation history
   - Use existing IDs from context rather than searching again
   - Performance tip: avoid redundant searches when ID already available
   
   Examples:
   - Previous step created resource → User says "move it" → use that resource ID
   - Previous step found resource → User says "update it" → use that resource ID
   - ONLY search if user mentions a different entity or context changed

6. HANDLING REPLAN AFTER FAILURE:
   - If the user request contains text suggesting a previous failure 
     (e.g., "Previous execution attempt failed", error messages with tool names),
     you are in a REPLAN context.
   - Do NOT regenerate the exact same plan that just failed.
   - Use the "Entities currently available" section to understand what exists.
   - If the failed step requires an entity that is NOT in the available entities list:
     * The user wants to operate on something that does not exist yet
     * Add a step to CREATE that entity first (use a 'create' category tool)
     * Only then chain the original operation
   - If the failed step requires an entity that IS in the available entities list:
     * The issue is parameter propagation, not entity existence
     * Verify that previous steps output the ID correctly
   - Never assume an entity exists; always check the available entities list.

Return ONLY valid JSON (no markdown, no backticks):
{
  "steps": [
    {
      "order": 1,
      "toolName": "<tool_name>",
      "description": "<what this step does>",
      "dependencies": [],
      "stepInputs": { "<param>": "<value>" }
    }
  ],
  "reasoning": "<brief explanation of execution order and why>"
}`;

  try {
    const response = await client.chat.completions.create({
      model: settings.llmModel,
      messages: [{ role: 'user', content: planningPrompt }],
      temperature: 0.2,
      max_tokens: 2048,
    });

    const responseText = response.choices[0].message.content || '';
    logger.info({ plan: responseText }, 'execution plan generated');

    const plan = JSON.parse(responseText) as ExecutionPlan;
    return plan;
  } catch (error) {
    logger.error({ error }, 'Failed to create execution plan');
    throw new Error('Failed to plan execution');
  }
}
