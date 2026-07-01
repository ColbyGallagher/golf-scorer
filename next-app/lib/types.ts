export type PlayerId = 'colby' | 'mitch' | 'dave' | 'scott';
export type Team = 'A' | 'B';
export type WolfMode = 'solo' | 'partner' | 'blind' | 'alone';

export interface Player {
  id: PlayerId;
  name: string;
  team: Team;
  color: string;
}

export interface HoleData {
  par: number;
  idx: number;
}

export interface WolfHole {
  mode: WolfMode | null;
  partnerId: PlayerId | null;
}

export interface CompWinner {
  ctp: string;
  ld: string;
}

export interface ActiveGames {
  teamMultiplier: boolean;
  bestBall: boolean;
  aggregate: boolean;
  skins: boolean;
  nassau: boolean;
  ctp: boolean;
  longDrive: boolean;
  wolf: boolean;
  gross: boolean;
  net: boolean;
}

// ─── DE Tour types ────────────────────────────────────────────────────────────

export interface TourEvent {
  id: string;
  month: string;
  season: number;
  courseName: string;
  date: string;
  courseRating: number;
  slopeRating: number;
  par: number;
  teamA: PlayerId[];
  teamB: PlayerId[];
  teamFormat: 'multiplier' | 'worstBall' | 'bestBall';
  teamWinner: 'A' | 'B' | null;
  ctpWinner: PlayerId | null;
  ldWinner: PlayerId | null;
  roundHandicaps: Record<PlayerId, number>;
  threePuttCounts: Record<PlayerId, number>;
  poopWinner: PlayerId | null;
  roundId: number | null;
  source: 'excel' | 'app';
}

export interface HandicapScore {
  playerId: PlayerId;
  date: string;
  course: string;
  score: number;
  rating: number;
  slope: number;
  differential: number;
  source?: 'import' | 'app';
}

export interface TourPlayerPoints {
  net: number;
  threePlus: number;
  team: number;
  par3: number;
  par5: number;
  total: number;
}

export interface SeasonEntry {
  playerId: PlayerId;
  total: number;
  net: number;
  threePlus: number;
  team: number;
  par3: number;
  par5: number;
  threePutts: number;
  poops: number;
  behind: number;
}
