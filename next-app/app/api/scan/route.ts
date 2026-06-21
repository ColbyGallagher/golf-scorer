import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: { message: 'ANTHROPIC_API_KEY not configured' } }, { status: 500 });
  }

  const body = await request.text();

  let needsMcp = false;
  try { needsMcp = JSON.parse(body).mcp_servers != null; } catch { /* not JSON or no mcp_servers field */ }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (needsMcp) headers['anthropic-beta'] = 'mcp-client-2025-04-04';

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
