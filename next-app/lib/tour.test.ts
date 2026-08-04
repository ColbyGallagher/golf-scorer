import { describe, it, expect } from 'vitest';
import { netScorePoints, threePlusPoints, eventPoints, seasonLeaderboard } from './tour';
import { differential, handicapIndex } from './handicap';
import type { TourEvent, HandicapScore } from './types';
import type { HistoryRound } from './db';

// ─── Fixtures from 2026_DE Tour Leaderboard.xlsx ─────────────────────────────

// Jan – Magenta (27/1/2026)
// Pars / SI taken from sheet6 rows 7-8
const JAN_PARS    = [4,5,4,3,4,4,3,5,4, 5,4,3,4,4,3,4,4,5];
const JAN_INDICES = [5,9,3,14,11,15,18,13,1, 12,10,16,8,2,17,6,7,4];

const JAN_ROUND: HistoryRound = {
  id: 1,
  label: 'Magenta Shores',
  date: '2026-01-27T00:00:00.000Z',
  holesPlayed: 18,
  handicaps: { mitch: 15, colby: 20, scott: 25, dave: 18 },
  pars: JAN_PARS,
  indices: JAN_INDICES,
  scores: {
    mitch: [4,6,8,3,5,8,3,5,6, 6,6,3,6,6,8,7,4,8],
    colby: [7,5,5,5,5,4,4,4,7, 8,9,5,5,5,2,6,5,6],
    scott: [5,8,8,4,3,6,3,9,5, 5,4,5,6,6,5,10,4,8],
    dave:  [3,9,6,5,4,5,4,5,5, 4,7,4,3,5,4,8,5,6],
  },
  compWinners: {},
  teamAssignments: { mitch: 'A', dave: 'A', scott: 'B', colby: 'B' },
  activeGames: { teamMultiplier: true, bestBall: false, aggregate: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
  wolfOrder: [],
  wolfHoles: [],
  courseName: 'Magenta Shores',
  courseRating: 73,
  slopeRating: 135,
  selectedTee: 'yellow',
  threePutts: { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
};

const JAN_EVENT: TourEvent = {
  id: 'jan-2026',
  month: 'January',
  season: 2026,
  courseName: 'Magenta Shores',
  date: '2026-01-27T00:00:00.000Z',
  courseRating: 73,
  slopeRating: 135,
  par: 72,
  teamA: ['mitch', 'dave'],
  teamB: ['scott', 'colby'],
  teamFormat: 'multiplier',
  teamWinner: 'A',
  ctpWinner: 'mitch',
  ldWinner: 'mitch',
  roundHandicaps: { colby: 20, mitch: 15, scott: 25, dave: 18 },
  threePuttCounts: { mitch: 5, colby: 4, scott: 1, dave: 4 },
  poopWinner: 'mitch',
  roundId: 1,
  source: 'excel' as const,
};

// Feb – Toronto (8/5/2026)
const FEB_PARS    = [4,4,3,4,4,4,4,5,3, 4,5,3,4,4,3,4,5,4];
const FEB_INDICES = [8,12,17,10,1,6,4,15,14, 11,2,9,3,5,13,18,16,7];

const FEB_ROUND: HistoryRound = {
  id: 2,
  label: 'Toronto',
  date: '2026-05-08T00:00:00.000Z',
  holesPlayed: 18,
  handicaps: { mitch: 12, colby: 16, scott: 21, dave: 14 },
  pars: FEB_PARS,
  indices: FEB_INDICES,
  scores: {
    mitch: [8,5,4,6,5,5,5,5,3, 6,6,4,6,5,4,5,6,5],
    colby: [5,5,3,5,4,5,5,6,5, 4,6,4,7,5,4,5,6,6],
    scott: [6,6,4,8,5,5,6,8,4, 4,7,3,6,5,3,7,5,6],
    dave:  [4,4,5,6,5,5,4,7,4, 4,7,4,4,5,5,5,6,7],
  },
  compWinners: {},
  teamAssignments: { dave: 'A', scott: 'A', mitch: 'B', colby: 'B' },
  activeGames: { teamMultiplier: false, bestBall: true, aggregate: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
  wolfOrder: [],
  wolfHoles: [],
  courseName: 'Toronto',
  courseRating: 73,
  slopeRating: 135,
  selectedTee: 'yellow',
  threePutts: { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
};

const FEB_EVENT: TourEvent = {
  id: 'feb-2026',
  month: 'February',
  season: 2026,
  courseName: 'Toronto',
  date: '2026-05-08T00:00:00.000Z',
  courseRating: 73,
  slopeRating: 135,
  par: 71,
  teamA: ['dave', 'scott'],
  teamB: ['mitch', 'colby'],
  teamFormat: 'worstBall',
  teamWinner: 'B',
  ctpWinner: 'colby',
  ldWinner: 'colby',
  roundHandicaps: { colby: 16, mitch: 12, scott: 21, dave: 14 },
  threePuttCounts: { mitch: 4, colby: 2, scott: 0, dave: 4 },
  poopWinner: 'mitch',
  roundId: 2,
  source: 'excel' as const,
};

// Mar – Shortland (1/6/2026)
const MAR_PARS    = [5,3,4,3,5,4,4,5,4, 4,3,4,5,3,4,4,3,4];
const MAR_INDICES = [10,8,14,4,11,15,9,17,1, 16,12,5,7,18,3,2,6,13];

const MAR_ROUND: HistoryRound = {
  id: 3,
  label: 'Shortland Waters',
  date: '2026-06-01T00:00:00.000Z',
  holesPlayed: 18,
  handicaps: { mitch: 14, colby: 18, scott: 23, dave: 16 },
  pars: MAR_PARS,
  indices: MAR_INDICES,
  scores: {
    mitch: [6,5,6,3,6,4,5,8,5, 6,7,4,7,4,6,5,4,5],
    colby: [7,4,5,4,7,6,5,5,6, 5,3,5,5,3,7,6,4,5],
    scott: [7,5,5,5,8,6,6,6,7, 6,5,6,10,3,7,8,3,7],
    dave:  [8,4,6,4,7,5,7,7,7, 6,4,7,6,3,5,6,5,6],
  },
  compWinners: {},
  teamAssignments: { dave: 'A', scott: 'A', mitch: 'B', colby: 'B' },
  activeGames: { teamMultiplier: true, bestBall: false, aggregate: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
  wolfOrder: [],
  wolfHoles: [],
  courseName: 'Shortland Waters',
  courseRating: 72,
  slopeRating: 128,
  selectedTee: 'yellow',
  threePutts: { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
};

const MAR_EVENT: TourEvent = {
  id: 'mar-2026',
  month: 'March',
  season: 2026,
  courseName: 'Shortland Waters',
  date: '2026-06-01T00:00:00.000Z',
  courseRating: 72,
  slopeRating: 128,
  par: 71,
  teamA: ['dave', 'scott'],
  teamB: ['mitch', 'colby'],
  teamFormat: 'multiplier',
  teamWinner: 'B',
  ctpWinner: null,
  ldWinner: 'colby',
  roundHandicaps: { colby: 18, mitch: 14, scott: 23, dave: 16 },
  threePuttCounts: { mitch: 1, colby: 2, scott: 4, dave: 4 },
  poopWinner: 'scott',
  roundId: 3,
  source: 'excel' as const,
};

// ─── netScorePoints ───────────────────────────────────────────────────────────

describe('netScorePoints', () => {
  it('brackets correctly', () => {
    expect(netScorePoints(65)).toBe(70);  // <70
    expect(netScorePoints(70)).toBe(70);  // ≤70
    expect(netScorePoints(71)).toBe(50);  // 71-75
    expect(netScorePoints(75)).toBe(50);
    expect(netScorePoints(76)).toBe(40);  // 76-80
    expect(netScorePoints(80)).toBe(40);
    expect(netScorePoints(81)).toBe(35);  // 81-85
    expect(netScorePoints(85)).toBe(35);
    expect(netScorePoints(86)).toBe(30);  // 86-90
    expect(netScorePoints(90)).toBe(30);
    expect(netScorePoints(91)).toBe(25);  // 91+
    expect(netScorePoints(105)).toBe(25);
  });
});

// ─── threePlusPoints ──────────────────────────────────────────────────────────

describe('threePlusPoints', () => {
  it('sums only holes scoring ≥3 — Jan Mitch expect 12', () => {
    expect(threePlusPoints('mitch', JAN_ROUND.scores, JAN_PARS, { mitch: 15 }, JAN_INDICES)).toBe(12);
  });

  it('Jan Colby expect 17', () => {
    expect(threePlusPoints('colby', JAN_ROUND.scores, JAN_PARS, { colby: 20 }, JAN_INDICES)).toBe(17);
  });

  it('Jan Scott expect 23', () => {
    expect(threePlusPoints('scott', JAN_ROUND.scores, JAN_PARS, { scott: 25 }, JAN_INDICES)).toBe(23);
  });

  it('Jan Dave expect 18', () => {
    expect(threePlusPoints('dave', JAN_ROUND.scores, JAN_PARS, { dave: 18 }, JAN_INDICES)).toBe(18);
  });
});

// ─── eventPoints ─────────────────────────────────────────────────────────────

describe('eventPoints — Jan Magenta', () => {
  const pts = eventPoints(JAN_ROUND, JAN_EVENT);

  it('mitch total = 62', () => expect(pts.mitch.total).toBe(62));
  it('colby total = 57', () => expect(pts.colby.total).toBe(57));
  it('scott total = 63', () => expect(pts.scott.total).toBe(63));
  it('dave total = 78',  () => expect(pts.dave.total).toBe(78));

  it('mitch components: net30 + 3+12 + team10 + par35 + par55', () => {
    expect(pts.mitch).toEqual({ net: 30, threePlus: 12, team: 10, par3: 5, par5: 5, total: 62 });
  });

  it('colby components: net40 + 3+17 + team0 + par30 + par50', () => {
    expect(pts.colby).toEqual({ net: 40, threePlus: 17, team: 0, par3: 0, par5: 0, total: 57 });
  });
});

describe('eventPoints — Feb Toronto', () => {
  const pts = eventPoints(FEB_ROUND, FEB_EVENT);

  it('mitch total = 45', () => expect(pts.mitch.total).toBe(45));
  it('colby total = 76', () => expect(pts.colby.total).toBe(76));
  it('scott total = 55', () => expect(pts.scott.total).toBe(55));
  it('dave total = 55',  () => expect(pts.dave.total).toBe(55));
});

describe('eventPoints — Mar Shortland', () => {
  const pts = eventPoints(MAR_ROUND, MAR_EVENT);

  it('mitch total = 51', () => expect(pts.mitch.total).toBe(51));
  it('colby total = 77', () => expect(pts.colby.total).toBe(77));
  it('scott total = 36', () => expect(pts.scott.total).toBe(36));
  it('dave total = 30',  () => expect(pts.dave.total).toBe(30));
});

// ─── seasonLeaderboard ───────────────────────────────────────────────────────

describe('seasonLeaderboard — all 3 events', () => {
  const rounds: Record<string, HistoryRound> = {
    'jan-2026': JAN_ROUND,
    'feb-2026': FEB_ROUND,
    'mar-2026': MAR_ROUND,
  };
  const board = seasonLeaderboard([JAN_EVENT, FEB_EVENT, MAR_EVENT], rounds);

  it('colby leads with 210', () => {
    expect(board[0].playerId).toBe('colby');
    expect(board[0].total).toBe(210);
    expect(board[0].behind).toBe(0);
  });

  it('dave and mitch both at 163/158', () => {
    const dave  = board.find(e => e.playerId === 'dave')!;
    const mitch = board.find(e => e.playerId === 'mitch')!;
    expect(dave.total).toBe(163);
    expect(mitch.total).toBe(158);
  });

  it('scott has 154', () => {
    const scott = board.find(e => e.playerId === 'scott')!;
    expect(scott.total).toBe(154);
  });

  it('3-putt totals accumulate correctly', () => {
    const colby = board.find(e => e.playerId === 'colby')!;
    expect(colby.threePutts).toBe(4 + 2 + 2); // jan+feb+mar
  });

  it('poop counts', () => {
    const mitch = board.find(e => e.playerId === 'mitch')!;
    const scott = board.find(e => e.playerId === 'scott')!;
    expect(mitch.poops).toBe(2); // jan + feb
    expect(scott.poops).toBe(1); // mar
  });
});

// ─── differential & handicapIndex ────────────────────────────────────────────

describe('differential', () => {
  it('formula: (score - rating) * 113 / slope', () => {
    // Colby row 9 (Magenta): score=92, rating=72, slope=135
    // (92-72)*113/135 = 20*113/135 = 2260/135 ≈ 16.741
    expect(differential(92, 72, 135)).toBeCloseTo(16.741, 2);
  });

  it('matches a spreadsheet row exactly — Mitch Shortland Waters: score=88, rating=71, slope=130', () => {
    // (88-71)*113/130 = 17*113/130 = 1921/130 ≈ 14.777
    expect(differential(88, 71, 130)).toBeCloseTo(14.777, 2);
  });
});

describe('handicapIndex', () => {
  it('returns 0 for empty history', () => {
    expect(handicapIndex([])).toBe(0);
  });

  it('averages the best 8 of up to 20 scores', () => {
    // 20 scores: 18 at differential 20, 2 at differential 5
    const scores: HandicapScore[] = [
      ...Array.from({ length: 18 }, (_, i): HandicapScore => ({
        playerId: 'colby', date: `2025-01-${String(i + 1).padStart(2, '0')}`, course: 'X',
        score: 90, rating: 70, slope: 113, differential: 20,
      })),
      { playerId: 'colby', date: '2025-07-01', course: 'Y', score: 75, rating: 70, slope: 113, differential: 5 },
      { playerId: 'colby', date: '2025-07-02', course: 'Y', score: 75, rating: 70, slope: 113, differential: 5 },
    ];
    // best 8 of last 20: the two 5s + six 20s → avg = (5+5+20*6)/8 = 130/8 = 16.25
    expect(handicapIndex(scores)).toBeCloseTo(16.25, 4);
  });

  it('uses only the most recent 20 when history is longer', () => {
    // 25 scores; first 5 are very low (old), last 20 are high
    const old: HandicapScore[] = Array.from({ length: 5 }, (_, i): HandicapScore => ({
      playerId: 'mitch', date: `2024-01-${String(i + 1).padStart(2, '0')}`, course: 'Z',
      score: 70, rating: 70, slope: 113, differential: 0,
    }));
    const recent: HandicapScore[] = Array.from({ length: 20 }, (_, i): HandicapScore => ({
      playerId: 'mitch', date: `2025-01-${String(i + 1).padStart(2, '0')}`, course: 'Z',
      score: 92, rating: 70, slope: 113, differential: 22,
    }));
    // old ones excluded → best 8 of 20 high diffs → 22
    expect(handicapIndex([...old, ...recent])).toBeCloseTo(22, 4);
  });

  it('colby current index from spreadsheet ≈ 16.67', () => {
    const colbyScores: HandicapScore[] = [
      { playerId: 'colby', date: '2025-01-10', course: 'Shortland Waters',  score: 95, rating: 71, slope: 130, differential: 20.862 },
      { playerId: 'colby', date: '2025-02-17', course: 'Kooindah Waters',   score: 89, rating: 72, slope: 139, differential: 13.820 },
      { playerId: 'colby', date: '2025-03-10', course: 'Kooindah Waters',   score: 90, rating: 72, slope: 139, differential: 14.633 },
      { playerId: 'colby', date: '2025-04-04', course: 'Waratah',           score: 90, rating: 70, slope: 129, differential: 17.519 },
      { playerId: 'colby', date: '2025-05-11', course: 'Hunter Valley',     score: 93, rating: 70, slope: 126, differential: 20.627 },
      { playerId: 'colby', date: '2025-06-24', course: 'The Springs',       score: 97, rating: 71, slope: 127, differential: 23.134 },
      { playerId: 'colby', date: '2025-07-07', course: 'Magenta',           score: 92, rating: 72, slope: 135, differential: 16.741 },
      { playerId: 'colby', date: '2025-08-25', course: 'Toukley',           score: 98, rating: 72, slope: 124, differential: 23.694 },
      { playerId: 'colby', date: '2025-09-15', course: 'Belmont',           score: 92, rating: 72, slope: 125, differential: 18.080 },
      { playerId: 'colby', date: '2025-11-07', course: 'Magenta',           score: 97, rating: 73, slope: 135, differential: 20.089 },
      { playerId: 'colby', date: '2026-01-08', course: 'Toronto',           score: 90, rating: 69, slope: 128, differential: 18.539 },
      { playerId: 'colby', date: '2026-01-22', course: 'Shortland Waters',  score: 92, rating: 72, slope: 128, differential: 17.656 },
      { playerId: 'colby', date: '2024-09-26', course: 'Toukley',           score: 90, rating: 72, slope: 124, differential: 16.403 },
      { playerId: 'colby', date: '2024-10-10', course: 'Waratah',           score: 103, rating: 70, slope: 129, differential: 28.907 },
      { playerId: 'colby', date: '2024-10-24', course: 'Wyong',             score: 101, rating: 71, slope: 123, differential: 27.561 },
      { playerId: 'colby', date: '2024-11-07', course: 'The Springs',       score: 105, rating: 71, slope: 127, differential: 30.252 },
      { playerId: 'colby', date: '2024-12-05', course: 'Shortland Waters',  score: 100, rating: 71, slope: 130, differential: 25.208 },
      { playerId: 'colby', date: '2025-01-02', course: 'Kooindah Waters',   score: 110, rating: 72, slope: 139, differential: 30.892 },
      { playerId: 'colby', date: '2025-02-06', course: 'Wyong',             score: 96, rating: 71, slope: 123, differential: 22.967 },
      { playerId: 'colby', date: '2025-03-13', course: 'Nelson Bay',        score: 92, rating: 71, slope: 125, differential: 18.984 },
    ];
    // The spreadsheet shows current HI ≈ 16.674 (avg of best 8 of these 20)
    expect(handicapIndex(colbyScores)).toBeCloseTo(16.674, 0);
  });
});
