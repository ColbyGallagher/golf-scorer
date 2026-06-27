import type { TeeHole } from './db';

// In production set NEXT_PUBLIC_COURSE_API_URL to https://<worker>.workers.dev/api/course
const COURSE_API_URL = process.env.NEXT_PUBLIC_COURSE_API_URL || '/api/course';

export interface TeeMeta {
  course_rating: number;
  slope_rating: number;
}

export interface TransformedCourse {
  course_name: string;
  tees: Record<string, TeeHole[]>;
  teeMeta: Record<string, TeeMeta>;
}

interface ApiHole {
  par: number;
  yardage: number;
  handicap?: number;
}

interface ApiTeeSet {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  number_of_holes: number;
  holes: ApiHole[];
}

interface ApiCourse {
  id: number;
  club_name: string;
  course_name: string;
  tees: {
    male?: ApiTeeSet[];
    female?: ApiTeeSet[];
  };
}

// Parse color from tee_name like "21810, USGA, Blue, Men" → "blue"
function parseTeeColor(teeName: string): string {
  const parts = teeName.split(', ');
  return (parts.length >= 3 ? parts[2] : teeName).toLowerCase().trim();
}

export function transformApiCourse(api: ApiCourse): TransformedCourse {
  const tees: Record<string, TeeHole[]> = {};
  const teeMeta: Record<string, TeeMeta> = {};
  const seenKeys = new Set<string>();

  // Process male first so female suffixes on collision
  const groups: Array<{ sets: ApiTeeSet[]; gender: 'male' | 'female' }> = [
    { sets: api.tees?.male ?? [], gender: 'male' },
    { sets: api.tees?.female ?? [], gender: 'female' },
  ];

  for (const { sets, gender } of groups) {
    for (const teeSet of sets) {
      if (teeSet.number_of_holes !== 18 || !teeSet.holes?.length) continue;

      let key = parseTeeColor(teeSet.tee_name);
      if (!key) continue;
      if (seenKeys.has(key)) key = gender === 'female' ? `${key} (ladies)` : `${key} 2`;
      seenKeys.add(key);

      tees[key] = teeSet.holes.map(h => ({
        par: h.par,
        index: h.handicap ?? 0, // 0 = no SI data from API
      }));
      teeMeta[key] = {
        course_rating: teeSet.course_rating,
        slope_rating: teeSet.slope_rating,
      };
    }
  }

  return {
    course_name: api.course_name || api.club_name || 'Unknown',
    tees,
    teeMeta,
  };
}

interface SearchResponse {
  courses?: ApiCourse[];
}

interface CourseResponse {
  course?: ApiCourse;
}

async function callProxy(params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${COURSE_API_URL}?${qs}`);
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function fetchCourseByName(name: string): Promise<TransformedCourse | null> {
  try {
    const res = await callProxy({ search_query: name });
    if (!res.ok) return null;
    const data = await res.json() as SearchResponse;
    if (!data.courses?.length) return null;

    // Prefer exact normalized match, fall back to first result
    const target = normalizeName(name);
    let best = data.courses[0];
    for (const c of data.courses) {
      if (normalizeName(c.course_name || c.club_name || '') === target) {
        best = c;
        break;
      }
    }

    return transformApiCourse(best);
  } catch { return null; }
}

export async function fetchCourseById(id: number): Promise<TransformedCourse | null> {
  try {
    const res = await callProxy({ id: String(id) });
    if (!res.ok) return null;
    const data = await res.json() as CourseResponse;
    if (!data.course) return null;
    return transformApiCourse(data.course);
  } catch { return null; }
}
