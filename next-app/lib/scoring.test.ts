import { describe, it, expect } from 'vitest';
import {
  strokesOnHole,
  stablefordPoints,
  totalStableford,
  teamMultiplierHole,
  teamTotals,
  getWolfId,
  calcWolf,
  calcSkins,
  calcNassau,
  getPlayingHandicap,
  grossScore,
  netScore,
} from './scoring';
import type { Player, WolfHole } from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAYERS: Player[] = [
  { id: 'colby', name: 'Colby', team: 'A', color: '#22c55e' },
  { id: 'mitch', name: 'Mitch', team: 'A', color: '#f97316' },
  { id: 'dave',  name: 'Dave',  team: 'B', color: '#3b82f6' },
  { id: 'scott', name: 'Scott', team: 'B', color: '#ef4444' },
];

// Shortland Waters hole data
const PARS    = [5,3,4,3,5,4,4,5,4, 4,3,4,5,3,4,4,3,4];
const INDICES = [10,8,14,4,11,15,9,17,1, 16,12,5,7,18,3,2,6,13];

const HANDICAPS = { colby: 18, mitch: 14, dave: 16, scott: 0 };
const TEAMS     = { colby: 'A' as const, mitch: 'A' as const, dave: 'B' as const, scott: 'B' as const };

function emptyScores() {
  return Object.fromEntries(PLAYERS.map(p => [p.id, Array(18).fill(0)]));
}

function emptyWolfHoles(): WolfHole[] {
  return Array(18).fill(null).map(() => ({ mode: null, partnerId: null }));
}

// ── strokesOnHole ─────────────────────────────────────────────────────────────

describe('strokesOnHole', () => {
  it('gives 0 strokes to a scratch player on any hole', () => {
    for (let h = 0; h < 18; h++) {
      expect(strokesOnHole('scott', h, HANDICAPS, INDICES)).toBe(0);
    }
  });

  it('gives colby (HI 18) exactly 1 stroke on every hole', () => {
    // HI 18 → 1 stroke wherever SI <= 18 (all 18 holes)
    for (let h = 0; h < 18; h++) {
      expect(strokesOnHole('colby', h, HANDICAPS, INDICES)).toBe(1);
    }
  });

  it('gives mitch (HI 14) a stroke only on SI <= 14 holes', () => {
    // SI 1..14 → 14 holes get a stroke
    const withStroke = INDICES.filter(si => si <= 14).length;
    const actual = Array.from({ length: 18 }, (_, h) =>
      strokesOnHole('mitch', h, HANDICAPS, INDICES)
    ).filter(s => s === 1).length;
    expect(actual).toBe(withStroke); // 14 holes
  });

  it('gives 2 strokes on SI<=hcp-18 for a 20-handicapper', () => {
    const hcps = { player: 20 };
    const idxs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    // SI 1 and 2 → get 2 strokes (20-18=2, so SI <= 2)
    expect(strokesOnHole('player', 0, hcps, idxs)).toBe(2); // SI 1
    expect(strokesOnHole('player', 1, hcps, idxs)).toBe(2); // SI 2
    expect(strokesOnHole('player', 2, hcps, idxs)).toBe(1); // SI 3
  });
});

// ── stablefordPoints ─────────────────────────────────────────────────────────

describe('stablefordPoints', () => {
  it('returns null for no score (0 strokes)', () => {
    expect(stablefordPoints(0, 4, 'scott', 8, HANDICAPS, INDICES)).toBeNull();
  });

  // H9: par 4, SI 1 — colby gets 1 stroke (HI 18, SI<=18)
  // Net par → 2 pts
  it('gives 2 pts for net par', () => {
    expect(stablefordPoints(5, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(2);
    //   5 strokes - 1 stroke = net 4 = par → diff=0 → 2pts
  });

  it('gives 3 pts for net birdie', () => {
    // H9 par 4, colby (1 stroke): 4 gross → net 3 → birdie → 3pts
    expect(stablefordPoints(4, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(3);
  });

  it('gives 1 pt for net bogey', () => {
    // H9 par 4, colby (1 stroke): 6 gross → net 5 → bogey → 1pt
    expect(stablefordPoints(6, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(1);
  });

  it('gives 0 pts for net double bogey or worse', () => {
    expect(stablefordPoints(7, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(0);
    expect(stablefordPoints(10, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(0);
  });

  it('gives 4 pts for net eagle', () => {
    // par 4, colby (1 stroke): 3 gross → net 2 → eagle → 4pts
    expect(stablefordPoints(3, 4, 'colby', 8, HANDICAPS, INDICES)).toBe(4);
  });

  it('gives 5 pts for net albatross or better', () => {
    // par 5, colby (1 stroke, H1 SI10): 3 gross → net 2 → albatross → 5pts
    expect(stablefordPoints(3, 5, 'colby', 0, HANDICAPS, INDICES)).toBe(5);
  });

  it('scratch player gets no extra strokes', () => {
    // H9 par 4, scott (HI 0): 4 gross → net 4 → par → 2pts
    expect(stablefordPoints(4, 4, 'scott', 8, HANDICAPS, INDICES)).toBe(2);
    // 5 gross → net 5 → bogey → 1pt
    expect(stablefordPoints(5, 4, 'scott', 8, HANDICAPS, INDICES)).toBe(1);
  });
});

// ── totalStableford ──────────────────────────────────────────────────────────

describe('totalStableford', () => {
  it('returns 0 when no scores entered', () => {
    const scores = emptyScores();
    expect(totalStableford('colby', scores, PARS, HANDICAPS, INDICES)).toBe(0);
  });

  it('sums points correctly across all 18 holes', () => {
    const scores = emptyScores();
    // Give colby net par on every hole → 2 pts each → 36 total
    // colby gets 1 stroke on every hole (HI 18, all SI <= 18)
    // net par on par-5 = gross 6, par-4 = gross 5, par-3 = gross 4
    PARS.forEach((par, h) => { scores.colby[h] = par + 1; }); // gross = par+1, net = par
    expect(totalStableford('colby', scores, PARS, HANDICAPS, INDICES)).toBe(36);
  });
});

// ── teamMultiplierHole ───────────────────────────────────────────────────────

describe('teamMultiplierHole', () => {
  it('returns 0 scores when no scores', () => {
    const scores = emptyScores();
    const r = teamMultiplierHole(0, PLAYERS, scores, PARS, HANDICAPS, INDICES, TEAMS);
    expect(r.scoreA).toBe(0);
    expect(r.scoreB).toBe(0);
  });

  it('multiplies each team\'s players stableford together', () => {
    const scores = emptyScores();
    // H1: par 5, SI 10
    // colby (HI18, SI10<=18): 1 stroke → gross 6 = net 5 = par → 2pts
    // mitch (HI14, SI10<=14): 1 stroke → gross 6 = net 5 = par → 2pts  → scoreA = 2×2 = 4
    // dave  (HI16, SI10<=16): 1 stroke → gross 6 = net 5 = par → 2pts
    // scott (HI0):  0 strokes → gross 5 = net 5 = par → 2pts            → scoreB = 2×2 = 4
    scores.colby[0] = 6;
    scores.mitch[0] = 6;
    scores.dave[0]  = 6;
    scores.scott[0] = 5;
    const r = teamMultiplierHole(0, PLAYERS, scores, PARS, HANDICAPS, INDICES, TEAMS);
    expect(r.ptsA).toEqual([2, 2]);
    expect(r.ptsB).toEqual([2, 2]);
    expect(r.scoreA).toBe(4);
    expect(r.scoreB).toBe(4);
  });
});

// ── teamTotals ───────────────────────────────────────────────────────────────

describe('teamTotals', () => {
  it('returns zeroes when no scores', () => {
    const scores = emptyScores();
    const r = teamTotals(PLAYERS, scores, PARS, HANDICAPS, INDICES, TEAMS);
    expect(r).toEqual({ totA: 0, totB: 0 });
  });
});

// ── getWolfId ────────────────────────────────────────────────────────────────

describe('getWolfId', () => {
  const order = ['colby', 'mitch', 'dave', 'scott'];

  it('rotates through order for holes 0-3', () => {
    expect(getWolfId(0, order)).toBe('colby');
    expect(getWolfId(1, order)).toBe('mitch');
    expect(getWolfId(2, order)).toBe('dave');
    expect(getWolfId(3, order)).toBe('scott');
  });

  it('wraps around correctly for holes 4+', () => {
    expect(getWolfId(4,  order)).toBe('colby');  // 4%4=0
    expect(getWolfId(15, order)).toBe('scott');  // 15%4=3
    expect(getWolfId(17, order)).toBe('mitch');  // 17%4=1
  });

  it('returns null for empty order', () => {
    expect(getWolfId(0, [])).toBeNull();
  });
});

// ── calcWolf ─────────────────────────────────────────────────────────────────

describe('calcWolf', () => {
  it('returns empty pm when no scores entered', () => {
    const scores = emptyScores();
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'alone', partnerId: null };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.colby).toBe(0);
  });

  it('wolf alone: wolf wins 4 pts when he beats everyone', () => {
    const scores = emptyScores();
    // H1: par 5, SI 10, colby is wolf
    // colby: gross 5 (par+stroke=net4=birdie → 3pts)
    // everyone else: gross 6 (par+stroke=net5=par → 2pts)
    scores.colby[0] = 5; // net birdie → 3pts
    scores.mitch[0] = 6; // net par    → 2pts
    scores.dave[0]  = 6; // net par    → 2pts
    scores.scott[0] = 5; // net par    → 2pts (no stroke)
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'alone', partnerId: null };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.colby).toBe(4);
    expect(results[0].pm.mitch).toBe(0);
  });

  it('wolf alone: others win 2 pts each when wolf loses', () => {
    const scores = emptyScores();
    // colby wolf with worse score
    scores.colby[0] = 8; // gross 8, net 7 → double bogey → 0pts
    scores.mitch[0] = 6; // net par → 2pts
    scores.dave[0]  = 6;
    scores.scott[0] = 5;
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'alone', partnerId: null };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.colby).toBe(0);
    expect(results[0].pm.mitch).toBe(2);
    expect(results[0].pm.dave).toBe(2);
    expect(results[0].pm.scott).toBe(2);
  });

  it('wolf blind: wolf wins 8 pts when he beats everyone', () => {
    const scores = emptyScores();
    scores.colby[0] = 4; // net eagle → 4pts
    scores.mitch[0] = 6;
    scores.dave[0]  = 6;
    scores.scott[0] = 5;
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'blind', partnerId: null };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.colby).toBe(8);
  });

  it('wolf partner: winning team earns 2 pts each', () => {
    const scores = emptyScores();
    // colby (wolf) + mitch (partner) vs dave + scott
    // colby: net birdie (3pts), mitch: net birdie (3pts) → wolfTeam max = 3
    // dave: net par (2pts), scott: net par (2pts) → otherTeam max = 2
    scores.colby[0] = 5; // net birdie
    scores.mitch[0] = 5; // net birdie
    scores.dave[0]  = 6; // net par
    scores.scott[0] = 5; // net par (no stroke)
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'partner', partnerId: 'mitch' };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.colby).toBe(2);
    expect(results[0].pm.mitch).toBe(2);
    expect(results[0].pm.dave).toBe(0);
    expect(results[0].pm.scott).toBe(0);
  });

  it('wolf partner: losing team concedes 3 pts each to others', () => {
    const scores = emptyScores();
    scores.colby[0] = 8; // 0pts
    scores.mitch[0] = 8; // 0pts
    scores.dave[0]  = 5; // net birdie → 3pts
    scores.scott[0] = 4; // net eagle  → 4pts
    const wolfHoles = emptyWolfHoles();
    wolfHoles[0] = { mode: 'partner', partnerId: 'mitch' };
    const results = calcWolf(PLAYERS, scores, PARS, HANDICAPS, INDICES,
      ['colby','mitch','dave','scott'], wolfHoles);
    expect(results[0].pm.dave).toBe(3);
    expect(results[0].pm.scott).toBe(3);
    expect(results[0].pm.colby).toBe(0);
    expect(results[0].pm.mitch).toBe(0);
  });
});

// ── calcSkins ────────────────────────────────────────────────────────────────

describe('calcSkins', () => {
  it('marks unplayed holes', () => {
    const scores = emptyScores();
    const results = calcSkins(PLAYERS, scores, PARS, HANDICAPS, INDICES);
    expect(results[0].unplayed).toBe(true);
  });

  it('finds a clear skin winner', () => {
    const scores = emptyScores();
    // H1: colby gets net birdie (best), everyone else net par
    scores.colby[0] = 5; // net birdie → 3pts
    scores.mitch[0] = 6; // net par    → 2pts
    scores.dave[0]  = 6;
    scores.scott[0] = 5; // net par (no stroke)
    const results = calcSkins(PLAYERS, scores, PARS, HANDICAPS, INDICES);
    expect(results[0].winner?.id).toBe('colby');
    expect(results[0].value).toBe(1);
    expect(results[0].carry).toBe(0);
  });

  it('ties carry skins to the next hole', () => {
    const scores = emptyScores();
    // H1: all tie at net par
    scores.colby[0] = 6;
    scores.mitch[0] = 6;
    scores.dave[0]  = 6;
    scores.scott[0] = 5;
    // H2: colby wins cleanly
    scores.colby[1] = 3; // H2 par 3, SI 8 (colby gets stroke): net 2 = birdie → 3pts
    scores.mitch[1] = 4; // net par → 2pts
    scores.dave[1]  = 4;
    scores.scott[1] = 4;
    const results = calcSkins(PLAYERS, scores, PARS, HANDICAPS, INDICES);
    expect(results[0].winner).toBeNull();
    expect(results[0].tied).toBe(true);
    expect(results[1].winner?.id).toBe('colby');
    expect(results[1].value).toBe(2); // 1 carried + 1 current
  });
});

// ── calcNassau ────────────────────────────────────────────────────────────────

describe('calcNassau', () => {
  it('returns all zeros when no scores', () => {
    const scores = emptyScores();
    const r = calcNassau(PLAYERS, scores, PARS, HANDICAPS, INDICES, TEAMS);
    expect(r.front).toEqual({ a: 0, b: 0 });
    expect(r.back).toEqual({ a: 0, b: 0 });
    expect(r.full).toEqual({ a: 0, b: 0 });
  });

  it('full = front + back for each team', () => {
    const scores = emptyScores();
    // Give everyone net par on all 18 → 2pts each hole
    PARS.forEach((par, h) => {
      scores.colby[h] = par + 1; // 1 stroke received
      scores.mitch[h] = par + 1;
      scores.dave[h]  = par + 1;
      scores.scott[h] = par;     // scratch (no strokes)
    });
    const r = calcNassau(PLAYERS, scores, PARS, HANDICAPS, INDICES, TEAMS);
    expect(r.full.a).toBe(r.front.a + r.back.a);
    expect(r.full.b).toBe(r.front.b + r.back.b);
  });
});

// ── getPlayingHandicap ────────────────────────────────────────────────────────

describe('getPlayingHandicap', () => {
  const coursePar = PARS.reduce((a, b) => a + b, 0); // 71

  it('scratch player at par course with slope 113 → handicap 0', () => {
    // HI 0 → courseHcp = 0*(113/113) + (71-71) = 0 → round(0*0.95) = 0
    expect(getPlayingHandicap('scott', HANDICAPS, 71.0, 113, PARS)).toBe(0);
  });

  it('matches the formula from the existing app (colby HI18, CR71, SR113)', () => {
    // courseHcp = 18*(113/113) + (71.0-71) = 18+0 = 18 → round(18*0.95) = round(17.1) = 17
    expect(getPlayingHandicap('colby', HANDICAPS, 71.0, 113, PARS)).toBe(17);
  });

  it('applies slope correctly when above 113', () => {
    // mitch HI14, slope 125, CR 72, par 72
    // courseHcp = 14*(125/113) + (72-72) = 14*1.1062 ≈ 15.49 → round(15.49*0.95) = round(14.71) = 15
    const hcps = { mitch: 14 };
    expect(getPlayingHandicap('mitch', hcps, 72.0, 125, Array(18).fill(4))).toBe(15);
  });
});

// ── grossScore & netScore ─────────────────────────────────────────────────────

describe('grossScore', () => {
  it('sums all strokes', () => {
    const scores = emptyScores();
    scores.colby[0] = 5;
    scores.colby[1] = 3;
    expect(grossScore('colby', scores)).toBe(8);
  });

  it('returns 0 when no scores', () => {
    expect(grossScore('colby', emptyScores())).toBe(0);
  });
});

describe('netScore', () => {
  it('returns 0 when no scores entered', () => {
    expect(netScore('colby', emptyScores(), HANDICAPS, 71.0, 113, PARS)).toBe(0);
  });

  it('subtracts playing handicap from gross', () => {
    const scores = emptyScores();
    PARS.forEach((par, h) => { scores.colby[h] = par + 1; }); // gross = 71+18=89 (par+1 each)
    const gross = grossScore('colby', scores);
    const ph = getPlayingHandicap('colby', HANDICAPS, 71.0, 113, PARS);
    expect(netScore('colby', scores, HANDICAPS, 71.0, 113, PARS)).toBe(gross - ph);
  });
});
