import { NextRequest, NextResponse } from 'next/server';

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

  const upstream = await fetch(upstreamUrl, {
    headers: { Authorization: `Key ${apiKey}` },
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
