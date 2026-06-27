import { stablefordPoints } from './scoring';
import type { PlayerId, TourEvent, TourPlayerPoints, SeasonEntry } from './types';
import type { HistoryRound } from './db';

const PLAYER_IDS: PlayerId[] = ['colby', 'mitch', 'dave', 'scott'];

// Net score points bracket (gross − round handicap → bracket)
export function netScorePoints(net: number): number {
  if (net <= 70) return 70;
  if (net <= 75) return 50;
  if (net <= 80) return 40;
  if (net <= 85) return 35;
  if (net <= 90) return 30;
  return 25;
}

// Sum of stableford points on holes scoring ≥ 3 ("3+ points")
export function threePlusPoints(
  playerId: string,
  scores: Record<string, number[]>,
  pars: number[],
  handicaps: Record<string, number>,
  indices: number[],
): number {
  return (scores[playerId] ?? []).reduce((sum, strokes, h) => {
    const pts = stablefordPoints(strokes, pars[h], playerId, h, handicaps, indices) ?? 0;
    return sum + (pts >= 3 ? pts : 0);
  }, 0);
}

// Compute all 5 point components for every player in a single event.
// Uses round's raw handicaps (not WHS-adjusted) for both net and stableford,
// matching the spreadsheet's approach.
export function eventPoints(
  round: HistoryRound,
  event: TourEvent,
): Record<PlayerId, TourPlayerPoints> {
  const hcps = event.roundHandicaps as Record<string, number>;
  return Object.fromEntries(
    PLAYER_IDS.map(pid => {
      const gross = (round.scores[pid] ?? []).reduce((s, v) => s + (v || 0), 0);
      const net = gross > 0 ? gross - (hcps[pid] ?? 0) : 0;
      const netPts = gross > 0 ? netScorePoints(net) : 0;
      const threePlus = threePlusPoints(pid, round.scores, round.pars, hcps, round.indices);
      const playerTeam: 'A' | 'B' = event.teamA.includes(pid) ? 'A' : 'B';
      const teamPts = event.teamWinner === playerTeam ? 10 : 0;
      const par3Pts = event.ctpWinner === pid ? 5 : 0;
      const par5Pts = event.ldWinner === pid ? 5 : 0;
      const total = netPts + threePlus + teamPts + par3Pts + par5Pts;
      return [pid, { net: netPts, threePlus, team: teamPts, par3: par3Pts, par5: par5Pts, total }];
    }),
  ) as Record<PlayerId, TourPlayerPoints>;
}

// Cumulative season standings across all events with linked rounds.
export function seasonLeaderboard(
  events: TourEvent[],
  roundsByEventId: Record<string, HistoryRound>,
): SeasonEntry[] {
  const acc = Object.fromEntries(
    PLAYER_IDS.map(pid => [pid, { total: 0, net: 0, threePlus: 0, team: 0, par3: 0, par5: 0, threePutts: 0, poops: 0 }]),
  ) as Record<PlayerId, Omit<SeasonEntry, 'playerId' | 'behind'>>;

  for (const event of events) {
    const round = roundsByEventId[event.id];
    if (!round) continue;
    const pts = eventPoints(round, event);
    for (const pid of PLAYER_IDS) {
      const p = pts[pid];
      acc[pid].total     += p.total;
      acc[pid].net       += p.net;
      acc[pid].threePlus += p.threePlus;
      acc[pid].team      += p.team;
      acc[pid].par3      += p.par3;
      acc[pid].par5      += p.par5;
      acc[pid].threePutts += event.threePuttCounts?.[pid] ?? 0;
      if (event.poopWinner === pid) acc[pid].poops++;
    }
  }

  const sorted = [...PLAYER_IDS].sort((a, b) => acc[b].total - acc[a].total);
  const lead = acc[sorted[0]].total;
  return sorted.map(pid => ({ playerId: pid, ...acc[pid], behind: lead - acc[pid].total }));
}
