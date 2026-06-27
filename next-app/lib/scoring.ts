import type { Player, WolfHole, WolfMode } from './types';

export type { Player, WolfHole, WolfMode };

// ─── Stroke allocation ───────────────────────────────────────────────────────
// A player with handicap H gets a stroke on every hole whose SI <= H.
// For H > 18 they get 2 strokes on holes where SI <= (H - 18), etc.

export function strokesOnHole(
  playerId: string,
  hole: number,
  handicaps: Record<string, number>,
  indices: number[],
): number {
  const hcp = Math.max(0, Math.floor(handicaps[playerId]) || 0);
  const si = indices[hole];
  let strokes = 0;
  if (si <= hcp)      strokes++;
  if (si <= hcp - 18) strokes++;
  if (si <= hcp - 36) strokes++;
  return strokes;
}

// ─── Stableford ──────────────────────────────────────────────────────────────

export function stablefordPoints(
  strokes: number,
  par: number,
  playerId: string,
  hole: number,
  handicaps: Record<string, number>,
  indices: number[],
): number | null {
  if (!strokes || strokes <= 0) return null;
  const sr   = strokesOnHole(playerId, hole, handicaps, indices);
  const net  = strokes - sr;
  const diff = par - net;
  if (diff <= -2) return 0;
  if (diff === -1) return 1;
  if (diff ===  0) return 2;
  if (diff ===  1) return 3;
  if (diff ===  2) return 4;
  return 5;
}

export function totalStableford(
  playerId: string,
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
): number {
  return scores[playerId].reduce(
    (sum, strokes, hole) =>
      sum + (stablefordPoints(strokes, pars[hole], playerId, hole, handicaps, indices) ?? 0),
    0,
  );
}

// ─── Team multiplier ─────────────────────────────────────────────────────────

export interface TeamHoleResult {
  ptsA: number[];  // stableford pts per Team A player
  ptsB: number[];  // stableford pts per Team B player
  scoreA: number;  // product of ptsA
  scoreB: number;  // product of ptsB
}

export function teamMultiplierHole(
  hole: number,
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
  teamAssignments: Record<string, 'A' | 'B'>,
): TeamHoleResult {
  const teamPts = (team: 'A' | 'B') =>
    players
      .filter(p => teamAssignments[p.id] === team)
      .map(p => stablefordPoints(scores[p.id][hole], pars[hole], p.id, hole, handicaps, indices) ?? 0);
  const ptsA = teamPts('A');
  const ptsB = teamPts('B');
  return {
    ptsA,
    ptsB,
    scoreA: ptsA.reduce((acc, p) => acc * p, 1),
    scoreB: ptsB.reduce((acc, p) => acc * p, 1),
  };
}

export interface TeamTotals {
  totA: number;
  totB: number;
}

export function teamTotals(
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
  teamAssignments: Record<string, 'A' | 'B'>,
): TeamTotals {
  let totA = 0, totB = 0;
  for (let h = 0; h < 18; h++) {
    const r = teamMultiplierHole(h, players, scores, pars, handicaps, indices, teamAssignments);
    totA += r.scoreA;
    totB += r.scoreB;
  }
  return { totA, totB };
}

// ─── Best Ball ───────────────────────────────────────────────────────────────

export interface BestBallResult {
  totA: number;
  totB: number;
  mode: 'stableford' | 'gross';
}

export function calcBestBall(
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
  teamAssignments: Record<string, 'A' | 'B'>,
  useGross = false,
): BestBallResult {
  let totA = 0, totB = 0;
  for (let h = 0; h < 18; h++) {
    for (const team of ['A', 'B'] as const) {
      const teamPlayers = players.filter(p => teamAssignments[p.id] === team);
      const played = teamPlayers.filter(p => scores[p.id][h] > 0);
      if (!played.length) continue;
      const best = useGross
        ? Math.min(...played.map(p => scores[p.id][h]))
        : Math.max(...teamPlayers.map(p =>
            stablefordPoints(scores[p.id][h], pars[h], p.id, h, handicaps, indices) ?? 0,
          ));
      if (team === 'A') totA += best;
      else totB += best;
    }
  }
  return { totA, totB, mode: useGross ? 'gross' : 'stableford' };
}

// ─── Wolf ────────────────────────────────────────────────────────────────────

export function getWolfId(hole: number, wolfOrder: string[], overrides: Record<number, string> = {}): string | null {
  if (overrides[hole]) return overrides[hole];
  return wolfOrder.length ? wolfOrder[hole % wolfOrder.length] : null;
}

export interface WolfHoleResult {
  hole: number;
  wolfId: string | null;
  mode: WolfMode | null;
  partnerId: string | null;
  pm: Record<string, number>;
}

export function calcWolf(
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
  wolfOrder: string[],
  wolfHoles: WolfHole[],
  wolfOverrides: Record<number, string> = {},
): WolfHoleResult[] {
  return Array.from({ length: 18 }, (_, h) => {
    const wolfId = getWolfId(h, wolfOrder, wolfOverrides);
    const wh     = wolfHoles[h];
    const pm: Record<string, number> = Object.fromEntries(players.map(p => [p.id, 0]));

    if (!wh?.mode || !wolfId || !players.some(p => scores[p.id][h] > 0)) {
      return { hole: h, wolfId, mode: wh?.mode ?? null, partnerId: wh?.partnerId ?? null, pm };
    }

    const wolfPts = stablefordPoints(scores[wolfId][h], pars[h], wolfId, h, handicaps, indices) ?? 0;
    const others  = players.filter(p => p.id !== wolfId);

    if (wh.mode === 'blind' || wh.mode === 'alone') {
      const maxOther = Math.max(
        ...others.map(p => stablefordPoints(scores[p.id][h], pars[h], p.id, h, handicaps, indices) ?? 0),
      );
      const winPts = wh.mode === 'blind' ? 8 : 4;
      if (wolfPts > maxOther)      pm[wolfId] = winPts;
      else if (wolfPts < maxOther) others.forEach(p => { pm[p.id] = 2; });
    } else if (wh.mode === 'partner' && wh.partnerId) {
      const pPts     = stablefordPoints(scores[wh.partnerId][h], pars[h], wh.partnerId, h, handicaps, indices) ?? 0;
      const otherTwo = others.filter(p => p.id !== wh.partnerId);
      const wolfTeam  = Math.max(wolfPts, pPts);
      const otherTeam = Math.max(
        ...otherTwo.map(p => stablefordPoints(scores[p.id][h], pars[h], p.id, h, handicaps, indices) ?? 0),
      );
      if (wolfTeam > otherTeam)      { pm[wolfId] = 2; pm[wh.partnerId] = 2; }
      else if (wolfTeam < otherTeam) otherTwo.forEach(p => { pm[p.id] = 3; });
    }

    return { hole: h, wolfId, mode: wh.mode, partnerId: wh.partnerId ?? null, pm };
  });
}

// ─── Skins ───────────────────────────────────────────────────────────────────

export interface SkinResult {
  hole: number;
  unplayed: boolean;
  winner: Player | null;
  value: number;
  carry: number;
  tied: boolean;
}

export function calcSkins(
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
): SkinResult[] {
  const results: SkinResult[] = [];
  let carry = 0;

  for (let h = 0; h < 18; h++) {
    if (!players.some(p => scores[p.id][h] > 0)) {
      results.push({ hole: h, unplayed: true, winner: null, value: 0, carry, tied: false });
      continue;
    }
    const pts = players.map(p => ({
      p,
      pts: stablefordPoints(scores[p.id][h], pars[h], p.id, h, handicaps, indices) ?? 0,
    }));
    const max     = Math.max(...pts.map(x => x.pts));
    const winners = pts.filter(x => x.pts === max && max > 0);

    if (winners.length === 1) {
      results.push({ hole: h, unplayed: false, winner: winners[0].p, value: 1 + carry, carry, tied: false });
      carry = 0;
    } else {
      results.push({ hole: h, unplayed: false, winner: null, value: 0, carry, tied: max > 0 });
      if (max > 0) carry++;
    }
  }
  return results;
}

// ─── Nassau ──────────────────────────────────────────────────────────────────

export interface NassauResult {
  front: { a: number; b: number };
  back:  { a: number; b: number };
  full:  { a: number; b: number };
}

export function calcNassau(
  players: Player[],
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
  teamAssignments: Record<string, 'A' | 'B'>,
): NassauResult {
  function teamPts(team: 'A' | 'B', from: number, to: number): number {
    return players
      .filter(p => teamAssignments[p.id] === team)
      .reduce((s, p) => {
        for (let h = from; h < to; h++)
          s += stablefordPoints(scores[p.id][h], pars[h], p.id, h, handicaps, indices) ?? 0;
        return s;
      }, 0);
  }
  return {
    front: { a: teamPts('A', 0, 9),  b: teamPts('B', 0, 9) },
    back:  { a: teamPts('A', 9, 18), b: teamPts('B', 9, 18) },
    full:  { a: teamPts('A', 0, 18), b: teamPts('B', 0, 18) },
  };
}

// ─── Handicap & stroke play ───────────────────────────────────────────────────

// World Handicap System: Course Handicap = HI × (Slope/113) + (CR - Par), 95% allowance
export function getPlayingHandicap(
  playerId: string,
  handicaps: Record<string, number>,
  courseRating: number,
  slopeRating: number,
  pars: number[],
): number {
  const hi        = parseFloat(String(handicaps[playerId])) || 0;
  const coursePar = pars.reduce((a, b) => a + b, 0);
  const courseHcp = hi * (slopeRating / 113) + (courseRating - coursePar);
  return Math.round(courseHcp * 0.95);
}

// Returns effective playing handicap per player: override if set, else WHS-computed
export function getEffectivePlayingHandicaps(
  handicaps: Record<string, number>,
  overrides: Partial<Record<string, number>>,
  courseRating: number,
  slopeRating: number,
  pars: number[],
): Record<string, number> {
  return Object.fromEntries(
    Object.keys(handicaps).map(pid => [
      pid,
      overrides[pid] !== undefined
        ? overrides[pid]!
        : getPlayingHandicap(pid, handicaps, courseRating, slopeRating, pars),
    ])
  );
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function ptsClass(pts: number | null): string {
  if (pts === null) return 'pts-null';
  if (pts === 0)    return 'pts-0';
  if (pts === 1)    return 'pts-1';
  if (pts === 2)    return 'pts-2';
  if (pts === 3)    return 'pts-3';
  if (pts === 4)    return 'pts-4';
  return 'pts-5p';
}

export function ptsLabel(pts: number | null): string {
  if (pts === null) return '–';
  return `${pts}${pts === 1 ? 'pt' : 'pts'}`;
}

export function grossScore(playerId: string, scores: Record<string, number[]>): number {
  return scores[playerId].reduce((s, v) => s + v, 0);
}

export function netScore(
  playerId: string,
  scores: Record<string, number[]>,
  handicaps: Record<string, number>,
  courseRating: number,
  slopeRating: number,
  pars: number[],
): number {
  const gross = grossScore(playerId, scores);
  if (!gross) return 0;
  return gross - getPlayingHandicap(playerId, handicaps, courseRating, slopeRating, pars);
}
