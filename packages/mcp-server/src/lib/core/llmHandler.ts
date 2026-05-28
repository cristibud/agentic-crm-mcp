import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat';
import { logger } from '../logger.js';
import type { Settings, ToolDefinition } from '../types/types.js';

function createOpenAIClient(settings: Settings): OpenAI {
  logger.debug({ model: settings.llmModel, baseUrl: settings.llmBaseUrl, keyLength: settings.llmApiKey?.length }, 'creating OpenAI client');
  
  if (!settings.llmApiKey) {
    logger.error('LLM API Key is empty or undefined');
    throw new Error('LLM API Key is not configured');
  }

  return new OpenAI({
    apiKey: settings.llmApiKey,
    baseURL: settings.llmBaseUrl,
  });
}

export async function handleUserMessage(
  userMessage: string,
  tools: ToolDefinition[],
  conversationHistory: ChatCompletionMessageParam[] = [],
  settings: Settings,
): Promise<{
  response: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  messages: ChatCompletionMessageParam[];
}> {
  try {
    const client = createOpenAIClient(settings);

    // Add user message to history
    const messages: ChatCompletionMessageParam[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // System prompt to encourage step-by-step planning and multi-step tool execution
    const systemPrompt = `You are a helpful assistant with access to a set of tools. When handling user requests:
1. ALWAYS break down tasks into logical steps
2. If you need to search/find something first, then update it, PLAN BOTH STEPS
3. Report each step clearly: First I'll [search/find], then I'll [update/create]
4. Execute multiple related tools in sequence to complete the user's request
5. Be concise but informative in your responses
6. After tool execution, summarize what was done`;

    logger.info({ toolsCount: tools.length, model: settings.llmModel }, 'processing message with LLM');

    // Call OpenAI with tools
    const response = await client.chat.completions.create({
      model: settings.llmModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      max_tokens: 1024,
    });

    const assistantMessage = response.choices[0].message;
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
    let textResponse = '';

    // Handle tool calls if any
    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: args,
            });
            logger.info({ toolName: toolCall.function.name, toolId: toolCall.id }, 'tool call identified');
          } catch (e) {
            logger.error({ error: e }, 'Failed to parse tool arguments');
          }
        }
      }
    }

    // Extract text response
    if (assistantMessage.content) {
      textResponse = assistantMessage.content;
    }

    // Add assistant message to history
    const updatedMessages: ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: assistantMessage.tool_calls,
      },
    ];

    return {
      response: textResponse,
      toolCalls,
      messages: updatedMessages,
    };
  } catch (error) {
    logger.error({ error }, 'LLM error');
    throw error;
  }
}

export async function executeToolsAndRespond(
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>,
  conversationHistory: ChatCompletionMessageParam[],
  settings: Settings,
): Promise<{
  response: string;
  messages: ChatCompletionMessageParam[];
  executedResults: Array<{ name: string; result: unknown; error?: string }>;
}> {
  const client = createOpenAIClient(settings);
  const toolResults: ChatCompletionToolMessageParam[] = [];
  const executedResults: Array<{ name: string; result: unknown; error?: string }> = [];

  // Execute tools
  for (const toolCall of toolCalls) {
    const executor = toolExecutors[toolCall.name];
    if (!executor) {
      logger.warn({ toolName: toolCall.name }, 'No executor found for tool');
      continue;
    }

    try {
      const result = await executor(toolCall.arguments);
      toolResults.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
      executedResults.push({ name: toolCall.name, result });
      logger.info({ toolName: toolCall.name, toolId: toolCall.id }, 'tool executed successfully');
    } catch (error) {
      const errMsg = String(error);
      logger.error({ toolName: toolCall.name, toolId: toolCall.id, error }, 'Tool execution failed');
      toolResults.push({
        role: 'tool',
        content: JSON.stringify({ error: errMsg }),
        tool_call_id: toolCall.id,
      });
      executedResults.push({ name: toolCall.name, result: null, error: errMsg });
    }
  }

  // Send tool results back to LLM for final response
  const messagesWithResults: ChatCompletionMessageParam[] = [
    ...conversationHistory,
    ...toolResults,
  ];

  const finalResponse = await client.chat.completions.create({
    model: settings.llmModel,
    messages: messagesWithResults,
    max_tokens: 1024,
  });

  const finalMessage = finalResponse.choices[0].message.content || 'Operation completed';

  return {
    response: finalMessage,
    messages: [
      ...messagesWithResults,
      { role: 'assistant', content: finalMessage },
    ],
    executedResults,
  };
}
