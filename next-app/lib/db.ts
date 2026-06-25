import { supabase } from './supabase';
import type { CompWinner, ActiveGames, WolfHole, PlayerId } from './types';

export interface TeeHole { par: number; index: number; indices?: number[] }

export interface SavedCourse {
  id: string;
  course_name: string;
  tees: Record<string, TeeHole[]>;
  scanned_at: string;
}

export interface HistoryRound {
  id: number;
  label: string;
  date: string;
  holesPlayed: number;
  handicaps: Record<string, number>;
  pars: number[];
  indices: number[];
  scores: Record<string, number[]>;
  compWinners: Record<number, CompWinner>;
  teamAssignments: Record<string, string>;
  activeGames: ActiveGames;
  wolfOrder: PlayerId[];
  wolfHoles: WolfHole[];
  courseName: string;
  courseRating: number;
  slopeRating: number;
  selectedTee: string;
  threePutts: Record<string, boolean[]>;
}

function entryToRow(entry: HistoryRound) {
  return {
    id:               entry.id,
    label:            entry.label,
    date:             entry.date,
    holes_played:     entry.holesPlayed,
    handicaps:        entry.handicaps,
    pars:             entry.pars,
    indices:          entry.indices,
    scores:           entry.scores,
    comp_winners:     entry.compWinners,
    team_assignments: entry.teamAssignments,
    active_games:     entry.activeGames,
    wolf_order:       entry.wolfOrder,
    wolf_holes:       entry.wolfHoles,
    course_name:      entry.courseName,
    course_rating:    entry.courseRating,
    slope_rating:     entry.slopeRating,
    selected_tee:     entry.selectedTee,
    three_putts:      entry.threePutts,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: any): HistoryRound {
  return {
    id:               row.id,
    label:            row.label ?? '',
    date:             row.date ?? '',
    holesPlayed:      row.holes_played ?? 0,
    handicaps:        row.handicaps ?? {},
    pars:             row.pars ?? [],
    indices:          row.indices ?? [],
    scores:           row.scores ?? {},
    compWinners:      row.comp_winners ?? {},
    teamAssignments:  row.team_assignments ?? {},
    activeGames:      row.active_games ?? {},
    wolfOrder:        row.wolf_order ?? [],
    wolfHoles:        row.wolf_holes ?? [],
    courseName:       row.course_name ?? '',
    courseRating:     row.course_rating ?? 71.0,
    slopeRating:      row.slope_rating ?? 113,
    selectedTee:      row.selected_tee ?? '',
    threePutts:       row.three_putts ?? {},
  };
}

export async function saveRoundToCloud(entry: HistoryRound): Promise<'saved' | 'error'> {
  try {
    const { error } = await supabase.from('rounds').upsert(entryToRow(entry));
    if (error) throw error;
    return 'saved';
  } catch {
    return 'error';
  }
}

export async function deleteRoundFromCloud(id: number): Promise<'deleted' | 'error'> {
  try {
    const { error } = await supabase.from('rounds').delete().eq('id', id);
    if (error) throw error;
    return 'deleted';
  } catch {
    return 'error';
  }
}

export async function syncRoundsFromCloud(local: HistoryRound[]): Promise<HistoryRound[] | null> {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('id', { ascending: false });
    if (error || !data) return null;
    const localIds = new Set(local.map(r => r.id));
    const merged = [...local];
    for (const row of data) {
      const entry = rowToEntry(row);
      if (!localIds.has(entry.id)) merged.push(entry);
    }
    merged.sort((a, b) => b.id - a.id);
    return merged;
  } catch {
    return null;
  }
}

let cachedCourses: SavedCourse[] | null = null;

export function invalidateCourseCache() { cachedCourses = null; }

export async function fetchAllCourses(): Promise<SavedCourse[]> {
  try {
    const { data, error } = await supabase
      .from('scorecards')
      .select('id, course_name, tees, scanned_at')
      .order('scanned_at', { ascending: false });
    if (error || !data) return [];
    const seen = new Set<string>();
    return (data as SavedCourse[]).filter(c => {
      const key = (c.course_name || '').trim().toLowerCase();
      if (!key || key === 'unknown' || !c.tees || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch { return []; }
}

export async function updateScorecard(
  id: string,
  courseName: string,
  tees: Record<string, TeeHole[]>,
): Promise<'saved' | 'error'> {
  try {
    const { error } = await supabase
      .from('scorecards')
      .update({ course_name: courseName, tees })
      .eq('id', id);
    if (error) throw error;
    cachedCourses = null;
    return 'saved';
  } catch { return 'error'; }
}

export async function fetchSavedCourses(): Promise<SavedCourse[]> {
  if (cachedCourses !== null) return cachedCourses;
  try {
    const { data, error } = await supabase
      .from('scorecards')
      .select('id, course_name, tees, scanned_at')
      .order('scanned_at', { ascending: false });
    if (error || !data) { cachedCourses = []; return []; }
    const seen = new Set<string>();
    cachedCourses = (data as SavedCourse[]).filter(c => {
      const key = (c.course_name || '').trim().toLowerCase();
      if (!key || key === 'unknown' || !c.tees || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch { cachedCourses = []; }
  return cachedCourses ?? [];
}
