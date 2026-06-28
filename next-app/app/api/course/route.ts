import { NextRequest, NextResponse } from 'next/server';

// force-static lets the export build pass. In production, NEXT_PUBLIC_COURSE_API_URL
// points to the Cloudflare worker, so this route is never called. It is only used as a
// local-dev fallback (when the env var is unset, courseApi.ts defaults to /api/course).
export const dynamic = 'force-static';

const BASE = 'https://api.golfcourseapi.com/v1';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOLF_COURSE_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const searchQuery = searchParams.get('search_query');
  const courseId = searchParams.get('id');

  let upstreamUrl: string;
  if (courseId) {
    upstreamUrl = `${BASE}/courses/${encodeURIComponent(courseId)}`;
  } else if (searchQuery) {
    upstreamUrl = `${BASE}/search?search_query=${encodeURIComponent(searchQuery)}`;
  } else {
    return NextResponse.json({ error: 'search_query or id required' }, { status: 400 });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });
  }
}
