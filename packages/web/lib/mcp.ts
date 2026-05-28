import Cookies from 'js-cookie';

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:3002';

let _rpcId = 1;

export interface McpRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export async function mcpCall<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const apiKey = Cookies.get('crm_api_key') || '';
  const body: McpRequest = {
    jsonrpc: '2.0',
    id: _rpcId++,
    method,
    params,
  };

  const res = await fetch(`${MCP_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP server error: HTTP ${res.status}`);
  }

  const data: McpResponse<T> = await res.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result as T;
}
