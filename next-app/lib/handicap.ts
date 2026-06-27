import type { HandicapScore } from './types';

export function differential(score: number, rating: number, slope: number): number {
  return ((score - rating) * 113) / slope;
}

// Average of best 8 differentials from the most recent 20 scores
export function handicapIndex(scores: HandicapScore[]): number {
  const recent = scores.slice(-20);
  if (!recent.length) return 0;
  const diffs = recent.map(s => s.differential).sort((a, b) => a - b);
  const best = diffs.slice(0, Math.min(8, diffs.length));
  return best.reduce((s, d) => s + d, 0) / best.length;
}
