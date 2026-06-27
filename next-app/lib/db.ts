import { supabase } from './supabase';
import type { CompWinner, ActiveGames, WolfHole, PlayerId, TourEvent, HandicapScore } from './types';

export interface TeeHole { par: number; index: number; indices?: number[] }

export interface SavedCourse {
  id: string;
  course_name: string;
  tees: Record<string, TeeHole[]>;
  scanned_at: string;
  lat?: number | null;
  lng?: number | null;
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
  wolfOverrides?: Record<number, string>;
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
    wolf_overrides:   entry.wolfOverrides ?? {},
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
    wolfOverrides:    row.wolf_overrides ?? {},
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
      .select('id, course_name, tees, scanned_at, lat, lng')
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

export async function renameCourse(oldName: string, newName: string): Promise<'saved' | 'error'> {
  try {
    const { error } = await supabase
      .from('scorecards')
      .update({ course_name: newName })
      .ilike('course_name', oldName);
    if (error) throw error;
    cachedCourses = null;
    return 'saved';
  } catch { return 'error'; }
}

export async function saveApiCourseToCloud(
  courseName: string,
  tees: Record<string, TeeHole[]>,
  lat?: number,
  lng?: number,
): Promise<'saved' | 'exists' | 'error'> {
  try {
    const { data: existing } = await supabase
      .from('scorecards')
      .select('id')
      .ilike('course_name', courseName)
      .limit(1);
    if (existing?.length) return 'exists';

    const { error } = await supabase.from('scorecards').insert({
      course_name: courseName,
      selected_tee: '',
      tees,
      image_path: null,
      lat: lat ?? null,
      lng: lng ?? null,
    });
    if (error) throw error;
    cachedCourses = null;
    return 'saved';
  } catch { return 'error'; }
}

// ─── Tour Events ─────────────────────────────────────────────────────────────

function tourEventToRow(e: TourEvent) {
  return {
    id:                 e.id,
    month:              e.month,
    season:             e.season,
    course_name:        e.courseName,
    date:               e.date,
    course_rating:      e.courseRating,
    slope_rating:       e.slopeRating,
    par:                e.par,
    team_a:             e.teamA,
    team_b:             e.teamB,
    team_format:        e.teamFormat,
    team_winner:        e.teamWinner,
    ctp_winner:         e.ctpWinner,
    ld_winner:          e.ldWinner,
    round_handicaps:    e.roundHandicaps,
    three_putt_counts:  e.threePuttCounts,
    poop_winner:        e.poopWinner,
    round_id:           e.roundId,
    source:             e.source,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTourEvent(row: any): TourEvent {
  return {
    id:               row.id,
    month:            row.month ?? '',
    season:           row.season ?? 0,
    courseName:       row.course_name ?? '',
    date:             row.date ?? '',
    courseRating:     row.course_rating ?? 72,
    slopeRating:      row.slope_rating ?? 113,
    par:              row.par ?? 72,
    teamA:            row.team_a ?? [],
    teamB:            row.team_b ?? [],
    teamFormat:       row.team_format ?? 'multiplier',
    teamWinner:       row.team_winner ?? null,
    ctpWinner:        row.ctp_winner ?? null,
    ldWinner:         row.ld_winner ?? null,
    roundHandicaps:   row.round_handicaps ?? {},
    threePuttCounts:  row.three_putt_counts ?? {},
    poopWinner:       row.poop_winner ?? null,
    roundId:          row.round_id ?? null,
    source:           row.source ?? 'excel',
  };
}

export async function fetchTourEvents(season?: number): Promise<TourEvent[]> {
  try {
    let q = supabase.from('tour_events').select('*').order('date', { ascending: true });
    if (season !== undefined) q = q.eq('season', season);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map(rowToTourEvent);
  } catch { return []; }
}

export async function saveTourEvent(event: TourEvent): Promise<'saved' | 'error'> {
  try {
    const { error } = await supabase.from('tour_events').upsert(tourEventToRow(event));
    if (error) throw error;
    return 'saved';
  } catch { return 'error'; }
}

export async function deleteTourEvent(id: string): Promise<'deleted' | 'error'> {
  try {
    const { error } = await supabase.from('tour_events').delete().eq('id', id);
    if (error) throw error;
    return 'deleted';
  } catch { return 'error'; }
}

// ─── Handicap Scores ─────────────────────────────────────────────────────────

function handicapScoreToRow(s: HandicapScore) {
  return {
    id:           `${s.playerId}-${s.date}`,
    player_id:    s.playerId,
    date:         s.date,
    course:       s.course,
    score:        s.score,
    rating:       s.rating,
    slope:        s.slope,
    differential: s.differential,
    source:       s.source ?? 'app',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToHandicapScore(row: any): HandicapScore {
  return {
    playerId:     row.player_id,
    date:         row.date,
    course:       row.course ?? '',
    score:        row.score ?? 0,
    rating:       row.rating ?? 0,
    slope:        row.slope ?? 113,
    differential: row.differential ?? 0,
    source:       row.source ?? 'import',
  };
}

export async function fetchHandicapScores(playerId?: PlayerId): Promise<HandicapScore[]> {
  try {
    let q = supabase.from('handicap_scores').select('*').order('date', { ascending: true });
    if (playerId) q = q.eq('player_id', playerId);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map(rowToHandicapScore);
  } catch { return []; }
}

export async function upsertHandicapScores(scores: HandicapScore[]): Promise<'saved' | 'error'> {
  try {
    const { error } = await supabase
      .from('handicap_scores')
      .upsert(scores.map(handicapScoreToRow), { onConflict: 'player_id,date' });
    if (error) throw error;
    return 'saved';
  } catch { return 'error'; }
}

export async function addHandicapScore(score: HandicapScore): Promise<'saved' | 'error'> {
  return upsertHandicapScores([score]);
}

export async function fetchSavedCourses(): Promise<SavedCourse[]> {
  if (cachedCourses !== null) return cachedCourses;
  try {
    const { data, error } = await supabase
      .from('scorecards')
      .select('id, course_name, tees, scanned_at, lat, lng')
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
