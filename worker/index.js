const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // GET /api/course — proxy to GolfCourseAPI
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/api/course') {
        if (!env.GOLF_COURSE_API_KEY) {
          return new Response(JSON.stringify({ error: 'GOLF_COURSE_API_KEY not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS },
          });
        }
        const searchQuery = url.searchParams.get('search_query');
        const courseId = url.searchParams.get('id');
        if (!searchQuery && !courseId) {
          return new Response(JSON.stringify({ error: 'search_query or id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS },
          });
        }
        const base = 'https://api.golfcourseapi.com/v1';
        const upstreamUrl = courseId
          ? `${base}/courses/${encodeURIComponent(courseId)}`
          : `${base}/search?search_query=${encodeURIComponent(searchQuery)}`;
        const upstream = await fetch(upstreamUrl, {
          headers: { Authorization: `Key ${env.GOLF_COURSE_API_KEY}` },
        });
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();

    // Add MCP beta header if the request uses remote MCP servers
    let needsMcp = false;
    try { needsMcp = JSON.parse(body).mcp_servers != null; } catch (_) {}

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };
    if (needsMcp) headers['anthropic-beta'] = 'mcp-client-2025-04-04';

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body,
    });

    const responseText = await upstream.text();

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
