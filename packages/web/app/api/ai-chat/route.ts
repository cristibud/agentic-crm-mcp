import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiCall(path: string, options: RequestInit = {}, apiKey: string) {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatLeads(leads: Array<Record<string, unknown>>) {
  if (!leads?.length) return 'No leads found.';
  return leads
    .map((l) => `• **${l.name}** (${l.email}) — ${l.company || 'no company'} | ${l.status} | Score: ${l.score}`)
    .join('\n');
}

function formatPipeline(stages: Array<Record<string, unknown>>) {
  if (!stages?.length) return 'No pipeline data.';
  return stages
    .map((s) => `• **${s.stage}**: ${s.count} deal${Number(s.count) !== 1 ? 's' : ''} — €${Number(s.totalValue).toLocaleString()}`)
    .join('\n');
}

function formatContracts(contracts: Array<Record<string, unknown>>) {
  if (!contracts?.length) return 'No contracts found.';
  return contracts
    .map((c) => {
      const deal = c.deal as Record<string, unknown> | undefined;
      const lead = deal?.lead as Record<string, unknown> | undefined;
      return `• **${c.number}** — ${lead?.name || 'Unknown client'} | ${c.status}`;
    })
    .join('\n');
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get('crm_api_key')?.value || '';

  const { message } = await req.json() as { message: string };
  const msg = (message || '').trim().toLowerCase();

  try {
    // Pattern: "list leads" or "leads"
    if (/^(list\s+)?leads?$/.test(msg) || msg.includes('show leads') || msg.includes('all leads')) {
      const result = await apiCall('/leads?limit=20', {}, apiKey);
      const leads = result?.data ?? result ?? [];
      return NextResponse.json({
        content: `Here are your leads:\n\n${formatLeads(leads)}`,
        toolCall: 'search_leads',
        toolResult: leads,
      });
    }

    // Pattern: "search leads [query]"
    if (/search leads?\s+(.+)/.test(msg)) {
      const query = msg.match(/search leads?\s+(.+)/)?.[1] ?? '';
      const result = await apiCall(`/leads?search=${encodeURIComponent(query)}&limit=20`, {}, apiKey);
      const leads = result?.data ?? result ?? [];
      return NextResponse.json({
        content: `Search results for "${query}":\n\n${formatLeads(leads)}`,
        toolCall: 'search_leads',
        toolResult: leads,
      });
    }

    // Pattern: "new lead: Name, email, company"
    const newLeadMatch = msg.match(/new lead[:\s]+(.+)/i);
    if (newLeadMatch || /create lead/.test(msg)) {
      const parts = (newLeadMatch?.[1] ?? '').split(',').map((p) => p.trim());
      const name = parts[0] || 'Unknown';
      const email = parts[1] || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
      const company = parts[2] || undefined;

      const lead = await apiCall('/leads', {
        method: 'POST',
        body: JSON.stringify({ name, email, company, source: 'OTHER' }),
      }, apiKey);

      return NextResponse.json({
        content: `Lead created:\n\n• **Name:** ${lead.name}\n• **Email:** ${lead.email}${company ? `\n• **Company:** ${company}` : ''}\n• **ID:** ${lead.id}`,
        toolCall: 'create_lead',
        toolResult: lead,
      });
    }

    // Pattern: "pipeline"
    if (/^pipeline$/.test(msg) || msg.includes('show pipeline') || msg.includes('deal stages')) {
      const result = await apiCall('/pipeline/summary', {}, apiKey);
      return NextResponse.json({
        content: `Pipeline summary:\n\n${formatPipeline(result)}`,
        toolCall: 'get_pipeline',
        toolResult: result,
      });
    }

    // Pattern: "contracts"
    if (/^contracts?$/.test(msg) || msg.includes('show contracts') || msg.includes('list contracts')) {
      const result = await apiCall('/contracts', {}, apiKey);
      return NextResponse.json({
        content: `Here are your contracts:\n\n${formatContracts(result)}`,
        toolCall: 'list_contracts',
        toolResult: result,
      });
    }

    // Pattern: "move deal [id] to [stage]"
    const moveMatch = msg.match(/move deal\s+(\S+)\s+to\s+(\w+)/i);
    if (moveMatch) {
      const [, dealId, stage] = moveMatch;
      const newStage = stage.toUpperCase();
      const deal = await apiCall(`/deals/${dealId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ newStage }),
      }, apiKey);
      return NextResponse.json({
        content: `Deal **${deal.title}** moved to **${newStage}**.`,
        toolCall: 'move_deal_stage',
        toolResult: deal,
      });
    }

    // Pattern: "deals" or "show deals"
    if (/^deals?$/.test(msg) || msg.includes('show deals') || msg.includes('all deals')) {
      const deals = await apiCall('/deals', {}, apiKey);
      const formatted = deals?.length
        ? deals.map((d: Record<string, unknown>) => `• **${d.title}** — €${Number(d.value).toLocaleString()} | ${d.stage}`).join('\n')
        : 'No deals found.';
      return NextResponse.json({
        content: `Your deals:\n\n${formatted}`,
        toolCall: 'list_deals',
        toolResult: deals,
      });
    }

    // Help fallback
    return NextResponse.json({
      content: `I can help you with:\n\n• **list leads** — show all leads\n• **search leads [query]** — search leads\n• **new lead: Name, email, company** — create a lead\n• **pipeline** — show pipeline summary\n• **contracts** — list contracts\n• **deals** — show all deals\n• **move deal [id] to [STAGE]** — move a deal\n\nTry one of the suggestions below!`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      content: `Error: ${msg}. Make sure the API server is running.`,
    });
  }
}
