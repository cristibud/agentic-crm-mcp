import { CONFIG } from './config.js';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': CONFIG.API_KEY,
};

export const apiClient = {
  async resetDatabase(): Promise<void> {
    // Deleting leads cascade-deletes deals and contracts (Prisma onDelete: Cascade).
    // Deals and contracts have no standalone DELETE endpoint in the API.
    const leadsRes = await fetch(`${CONFIG.API_URL}/api/leads?limit=100`, { headers });
    if (!leadsRes.ok) {
      console.warn(`[reset] GET /api/leads failed: ${leadsRes.status}`);
      return;
    }
    const data = await leadsRes.json() as any;
    const leads: any[] = data.data || (Array.isArray(data) ? data : []);
    if (leads.length === 0) return;
    for (const l of leads) {
      const del = await fetch(`${CONFIG.API_URL}/api/leads/${l.id}`, { method: 'DELETE', headers });
      if (!del.ok) console.warn(`[reset] DELETE /api/leads/${l.id} failed: ${del.status}`);
    }
  },

  async seedLead(lead: any): Promise<any> {
    const res = await fetch(`${CONFIG.API_URL}/api/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lead),
    });
    return res.json();
  },

  async getAllLeads(): Promise<any[]> {
    const res = await fetch(`${CONFIG.API_URL}/api/leads?limit=100`, { headers });
    const data = await res.json() as any;
    return data.data ?? (Array.isArray(data) ? data : []);
  },

  async getAllDeals(): Promise<any[]> {
    const res = await fetch(`${CONFIG.API_URL}/api/deals?limit=100`, { headers });
    const data = await res.json() as any;
    return data.data ?? (Array.isArray(data) ? data : []);
  },

  async getAllContracts(): Promise<any[]> {
    const res = await fetch(`${CONFIG.API_URL}/api/contracts?limit=100`, { headers });
    const data = await res.json() as any;
    return data.data ?? (Array.isArray(data) ? data : []);
  },

  /**
   * Send a message to the MCP orchestration endpoint.
   * Pass baseline=true to activate baseline mode per-request — no server restart needed.
   */
  async sendMessageToMCP(sessionId: string, message: string, baseline = false): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.TURN_TIMEOUT_MS);
    const url = `${CONFIG.MCP_URL}/message?sessionId=${encodeURIComponent(sessionId)}${baseline ? '&baseline=true' : ''}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.json();
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  },

  async resetMCPSession(sessionId: string): Promise<void> {
    await fetch(`${CONFIG.MCP_URL}/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
