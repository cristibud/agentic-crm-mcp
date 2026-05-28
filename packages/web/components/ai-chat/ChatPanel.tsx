'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: string;
  toolResult?: unknown;
  plan?: any;
  executionTrace?: any[];
  timestamp: Date;
}

const MCP_SERVER_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3002';

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content: "Hi! I'm your CRM AI assistant. I can help you manage leads, deals, and contracts.",
  timestamp: new Date(),
};

function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(generateSessionId);
  const [resetting, setResetting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const resetSession = async () => {
    if (resetting || loading) return;
    setResetting(true);
    try {
      await fetch(`${MCP_SERVER_URL}/session/${sessionId}`, { method: 'DELETE' });
    } catch {
      // Ignore network errors — local state is reset regardless
    } finally {
      setSessionId(generateSessionId());
      setMessages([{ ...INITIAL_MESSAGE, id: Date.now().toString(), timestamp: new Date() }]);
      setInput('');
      setResetting(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${MCP_SERVER_URL}/message?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      // Build assistant message with plan and traceability if available
      let planAndTraceText = '';
      
      if (data.plan && data.plan.steps) {
        planAndTraceText = `\n\n📋 **Execution Plan:**\n${data.plan.steps.map((s: any) => `${s.order}. ${s.toolName}: ${s.description}`).join('\n')}`;
      }

      // // Add traceability information if available
      // if (data.executionTrace && data.executionTrace.length > 0) {
      //   planAndTraceText += '\n\n🔗 **ID Traceability:**\n';
      //   data.executionTrace.forEach((trace: any) => {
      //     let traceInfo = `Step ${trace.stepOrder} (${trace.toolName}):`;
          
      //     if (Object.keys(trace.inputIds).length > 0) {
      //       const inputList = Object.entries(trace.inputIds)
      //         .map(([k, v]: any) => `${k}=${v}`)
      //         .join(', ');
      //       traceInfo += ` [Input: ${inputList}]`;
      //     }
          
      //     if (Object.keys(trace.outputIds).length > 0) {
      //       const outputList = Object.entries(trace.outputIds)
      //         .map(([k, v]: any) => `${k}=${v}`)
      //         .join(', ');
      //       traceInfo += ` → [Output: ${outputList}]`;
      //     }
          
      //     if (trace.error) {
      //       traceInfo += ` ❌ ${trace.error}`;
      //     }
          
      //     planAndTraceText += traceInfo + '\n';
      //   });
      // }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (data.response || 'No response') + planAndTraceText,
        toolCall: data.toolCalls?.[0]?.name,
        toolResult: data.toolCalls,
        plan: data.plan,
        executionTrace: data.executionTrace,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Refetch data after tools execution
      if (data.toolCalls && data.toolCalls.length > 0) {
        console.log('🔄 Tools executed, refreshing data...', data.toolCalls);
        // Emit custom event to notify all data hooks to refetch
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { toolCalls: data.toolCalls } }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ Failed to connect to AI assistant. Please check your connection.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
        <button
          onClick={resetSession}
          disabled={resetting || loading}
          title="New chat"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 disabled:opacity-40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {resetting ? 'Clearing...' : 'New chat'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-500">AI Assistant</span>
                </div>
              )}
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <MessageContent content={msg.content} />
              </div>
              
              {/* Execution Plan - Expandable */}
              {msg.plan && msg.plan.steps && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <ExecutionPlanDisplay plan={msg.plan} executionTrace={msg.executionTrace} />
                </div>
              )}

              <p className="text-xs text-gray-400 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            rows={2}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="self-end"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ExecutionPlanDisplay({ plan, executionTrace }: { plan: any; executionTrace?: any[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [expandedReasoning, setExpandedReasoning] = useState(false);

  const toggleStep = (stepOrder: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepOrder]: !prev[stepOrder],
    }));
  };

  const getStepTrace = (stepOrder: number) => {
    return executionTrace?.find((t) => t.stepOrder === stepOrder);
  };

  return (
    <div className="p-3 text-xs">
      <button
        onClick={() => setExpandedSteps((prev) => {
          const allExpanded = Object.values(prev).some((v) => !v);
          return Object.fromEntries(plan.steps.map((s: any) => [s.order, allExpanded]));
        })}
        className="text-blue-700 hover:text-blue-900 font-semibold mb-2 text-xs"
      >
        📋 Execution Plan{' '}
      </button>

      <div className="space-y-2">
        {plan.steps.map((step: any) => {
          const trace = getStepTrace(step.order);
          const isExpanded = expandedSteps[step.order];

          return (
            <div key={step.order} className="border border-blue-200 rounded bg-white">
              <button
                onClick={() => toggleStep(step.order)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-blue-700 font-semibold">Step {step.order}</span>
                  <span className="text-gray-600">{step.toolName}</span>
                  {trace?.error && <span className="text-red-600">❌ Failed</span>}
                  {trace && !trace.error && <span className="text-green-600">✅ Done</span>}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-blue-200 p-3 space-y-2 bg-blue-50 text-xs">
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">{step.description}</p>
                    <div className="bg-white p-2 rounded border border-blue-100 text-gray-600">
                      <p className="font-mono text-xs">{step.toolName}(</p>
                      {Object.entries(step.stepInputs || {}).map(([key, value]: any) => (
                        <p key={key} className="font-mono text-xs ml-2">
                          {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      ))}
                      <p className="font-mono text-xs">)</p>
                    </div>
                  </div>

                  {step.dependencies && step.dependencies.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-700">Dependencies:</p>
                      <p className="text-gray-600">
                        Depends on step{step.dependencies.length > 1 ? 's' : ''} {step.dependencies.join(', ')}
                      </p>
                    </div>
                  )}

                  {trace && (
                    <div className="space-y-2 border-t border-blue-200 pt-2 mt-2">
                      <p className="font-semibold text-gray-700">Execution Details:</p>

                      {Object.keys(trace.inputIds || {}).length > 0 && (
                        <div>
                          <p className="text-gray-600 font-semibold">📥 Input IDs:</p>
                          <div className="ml-2 bg-white p-2 rounded border border-blue-100">
                            {Object.entries(trace.inputIds).map(([key, value]: any) => (
                              <p key={key} className="text-gray-700">
                                <span className="text-gray-500">{key}:</span> {String(value).substring(0, 20)}...
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys(trace.outputIds || {}).length > 0 && (
                        <div>
                          <p className="text-gray-600 font-semibold">📤 Output IDs:</p>
                          <div className="ml-2 bg-white p-2 rounded border border-blue-100">
                            {Object.entries(trace.outputIds).map(([key, value]: any) => (
                              <p key={key} className="text-gray-700 text-xs">
                                <span className="text-gray-500">{key}:</span> {String(value).substring(0, 20)}...
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {trace.result && (
                        <StepResultDisplay result={trace.result} />
                      )}

                      {trace.error && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-red-700 font-semibold">Error:</p>
                          <p className="text-red-600">{trace.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {plan.reasoning && (
        <div className="mt-3 bg-blue-100 rounded border border-blue-300">
          <button
            onClick={() => setExpandedReasoning(!expandedReasoning)}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
          >
            <span className="font-semibold text-blue-900 text-xs">💡 Planning Logic</span>
            <svg
              className={`w-4 h-4 text-blue-700 transition-transform ${expandedReasoning ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          {expandedReasoning && (
            <div className="border-t border-blue-200 p-3 bg-blue-50">
              <p className="text-blue-800 text-xs">{plan.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepResultDisplay({ result }: { result: any }) {
  const [showFull, setShowFull] = useState(false);

  if (!result) return null;

  const isArray = Array.isArray(result);
  const items = isArray ? result : [result];
  const itemCount = items.length;
  const shouldTruncate = itemCount > 2 && !showFull;
  const displayItems = shouldTruncate ? items.slice(0, 1) : items;

  return (
    <div>
      <p className="font-semibold text-gray-600">📊 Result ({itemCount} item{itemCount !== 1 ? 's' : ''}):</p>
      <div className="ml-2 bg-white rounded border border-blue-100 p-2 max-h-64 overflow-y-auto">
        {displayItems.map((item, idx) => (
          <ResultItem key={idx} item={item} index={isArray ? idx : undefined} />
        ))}
        {shouldTruncate && (
          <button
            onClick={() => setShowFull(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold mt-2"
          >
            + Show {itemCount - 1} more...
          </button>
        )}
        {showFull && itemCount > 2 && (
          <button
            onClick={() => setShowFull(false)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold mt-2"
          >
            - Show less
          </button>
        )}
      </div>
    </div>
  );
}

function ResultItem({ item, index }: { item: any; index?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (typeof item !== 'object' || item === null) {
    return (
      <p className="text-gray-700 text-xs py-1">
        {index !== undefined ? `[${index}] ` : ''}
        {String(item)}
      </p>
    );
  }

  const keys = Object.keys(item).slice(0, 3);
  const hasMore = Object.keys(item).length > 3;

  return (
    <div className="py-1 border-b border-blue-50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-left text-gray-700 hover:text-blue-700 flex items-center gap-1"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
        </svg>
        {index !== undefined ? `[${index}] ` : ''}
        <span className="font-mono">
          {item.id || item.name || item.title || Object.keys(item)[0]}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 mt-1 space-y-1">
          {Object.entries(item).map(([key, value]: any) => (
            <p key={key} className="text-xs text-gray-600">
              <span className="text-gray-500">{key}:</span>{' '}
              {typeof value === 'object' ? JSON.stringify(value).substring(0, 30) : String(value).substring(0, 40)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
