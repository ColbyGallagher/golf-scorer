#!/usr/bin/env node
/**
 * seed-tour.mjs — import 2026 DE Tour historical data into Supabase.
 *
 * Upserts (idempotent):
 *   - 3 rounds         → rounds table
 *   - 3 tour_events    → tour_events table
 *   - 80 handicap_scores (20 per player) → handicap_scores table
 *
 * Usage (run from next-app/ directory):
 *   node scripts/seed-tour.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── .env.local ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const env = {};
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  } catch {
    console.error('Error: could not read .env.local — run from next-app/ directory.');
    process.exit(1);
  }
  return env;
}

// ── Round IDs (stable timestamps from each event date) ────────────────────────

const JAN_ID = new Date('2026-01-27T00:00:00.000Z').getTime(); // 1769472000000
const FEB_ID = new Date('2026-05-08T00:00:00.000Z').getTime(); // 1778198400000
const MAR_ID = new Date('2026-06-01T00:00:00.000Z').getTime(); // 1780272000000

// ── Round data ────────────────────────────────────────────────────────────────

const ROUNDS = [
  {
    id:               JAN_ID,
    label:            'Magenta Shores',
    date:             '2026-01-27T00:00:00.000Z',
    holes_played:     18,
    handicaps:        { mitch: 15, colby: 20, scott: 25, dave: 18 },
    pars:             [4,5,4,3,4,4,3,5,4, 5,4,3,4,4,3,4,4,5],
    indices:          [5,9,3,14,11,15,18,13,1, 12,10,16,8,2,17,6,7,4],
    scores: {
      mitch: [4,6,8,3,5,8,3,5,6, 6,6,3,6,6,8,7,4,8],
      colby: [7,5,5,5,5,4,4,4,7, 8,9,5,5,5,2,6,5,6],
      scott: [5,8,8,4,3,6,3,9,5, 5,4,5,6,6,5,10,4,8],
      dave:  [3,9,6,5,4,5,4,5,5, 4,7,4,3,5,4,8,5,6],
    },
    comp_winners:     {},
    team_assignments: { mitch: 'A', dave: 'A', scott: 'B', colby: 'B' },
    active_games:     { teamMultiplier: true, bestBall: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
    wolf_order:       [],
    wolf_holes:       Array(18).fill({ mode: null, partnerId: null }),
    wolf_overrides:   {},
    course_name:      'Magenta Shores',
    course_rating:    73,
    slope_rating:     135,
    selected_tee:     'yellow',
    three_putts:      { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
  },
  {
    id:               FEB_ID,
    label:            'Toronto',
    date:             '2026-05-08T00:00:00.000Z',
    holes_played:     18,
    handicaps:        { mitch: 12, colby: 16, scott: 21, dave: 14 },
    pars:             [4,4,3,4,4,4,4,5,3, 4,5,3,4,4,3,4,5,4],
    indices:          [8,12,17,10,1,6,4,15,14, 11,2,9,3,5,13,18,16,7],
    scores: {
      mitch: [8,5,4,6,5,5,5,5,3, 6,6,4,6,5,4,5,6,5],
      colby: [5,5,3,5,4,5,5,6,5, 4,6,4,7,5,4,5,6,6],
      scott: [6,6,4,8,5,5,6,8,4, 4,7,3,6,5,3,7,5,6],
      dave:  [4,4,5,6,5,5,4,7,4, 4,7,4,4,5,5,5,6,7],
    },
    comp_winners:     {},
    team_assignments: { dave: 'A', scott: 'A', mitch: 'B', colby: 'B' },
    active_games:     { teamMultiplier: false, bestBall: true, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
    wolf_order:       [],
    wolf_holes:       Array(18).fill({ mode: null, partnerId: null }),
    wolf_overrides:   {},
    course_name:      'Toronto',
    course_rating:    73,
    slope_rating:     135,
    selected_tee:     'yellow',
    three_putts:      { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
  },
  {
    id:               MAR_ID,
    label:            'Shortland Waters',
    date:             '2026-06-01T00:00:00.000Z',
    holes_played:     18,
    handicaps:        { mitch: 14, colby: 18, scott: 23, dave: 16 },
    pars:             [5,3,4,3,5,4,4,5,4, 4,3,4,5,3,4,4,3,4],
    indices:          [10,8,14,4,11,15,9,17,1, 16,12,5,7,18,3,2,6,13],
    scores: {
      mitch: [6,5,6,3,6,4,5,8,5, 6,7,4,7,4,6,5,4,5],
      colby: [7,4,5,4,7,6,5,5,6, 5,3,5,5,3,7,6,4,5],
      scott: [7,5,5,5,8,6,6,6,7, 6,5,6,10,3,7,8,3,7],
      dave:  [8,4,6,4,7,5,7,7,7, 6,4,7,6,3,5,6,5,6],
    },
    comp_winners:     {},
    team_assignments: { dave: 'A', scott: 'A', mitch: 'B', colby: 'B' },
    active_games:     { teamMultiplier: true, bestBall: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
    wolf_order:       [],
    wolf_holes:       Array(18).fill({ mode: null, partnerId: null }),
    wolf_overrides:   {},
    course_name:      'Shortland Waters',
    course_rating:    72,
    slope_rating:     128,
    selected_tee:     'yellow',
    three_putts:      { mitch: Array(18).fill(false), colby: Array(18).fill(false), scott: Array(18).fill(false), dave: Array(18).fill(false) },
  },
];

// ── Tour events ───────────────────────────────────────────────────────────────

const TOUR_EVENTS = [
  {
    id:                 'jan-2026',
    month:              'January',
    season:             2026,
    course_name:        'Magenta Shores',
    date:               '2026-01-27T00:00:00.000Z',
    course_rating:      73,
    slope_rating:       135,
    par:                72,
    team_a:             ['mitch', 'dave'],
    team_b:             ['scott', 'colby'],
    team_format:        'multiplier',
    team_winner:        'A',
    ctp_winner:         'mitch',
    ld_winner:          'mitch',
    round_handicaps:    { colby: 20, mitch: 15, scott: 25, dave: 18 },
    three_putt_counts:  { mitch: 5, colby: 4, scott: 1, dave: 4 },
    poop_winner:        'mitch',
    round_id:           JAN_ID,
    source:             'excel',
  },
  {
    id:                 'feb-2026',
    month:              'February',
    season:             2026,
    course_name:        'Toronto',
    date:               '2026-05-08T00:00:00.000Z',
    course_rating:      73,
    slope_rating:       135,
    par:                71,
    team_a:             ['dave', 'scott'],
    team_b:             ['mitch', 'colby'],
    team_format:        'worstBall',
    team_winner:        'B',
    ctp_winner:         'colby',
    ld_winner:          'colby',
    round_handicaps:    { colby: 16, mitch: 12, scott: 21, dave: 14 },
    three_putt_counts:  { mitch: 4, colby: 2, scott: 0, dave: 4 },
    poop_winner:        'mitch',
    round_id:           FEB_ID,
    source:             'excel',
  },
  {
    id:                 'mar-2026',
    month:              'March',
    season:             2026,
    course_name:        'Shortland Waters',
    date:               '2026-06-01T00:00:00.000Z',
    course_rating:      72,
    slope_rating:       128,
    par:                71,
    team_a:             ['dave', 'scott'],
    team_b:             ['mitch', 'colby'],
    team_format:        'multiplier',
    team_winner:        'B',
    ctp_winner:         null,
    ld_winner:          'colby',
    round_handicaps:    { colby: 18, mitch: 14, scott: 23, dave: 16 },
    three_putt_counts:  { mitch: 1, colby: 2, scott: 4, dave: 4 },
    poop_winner:        'scott',
    round_id:           MAR_ID,
    source:             'excel',
  },
];

// ── Handicap scores (extracted from 2026_DE Tour Leaderboard.xlsx) ────────────

const HANDICAP_SCORES = [
  { playerId: 'mitch', date: '2024-05-16', course: 'Toukley',          score: 90, rating: 72, slope: 124, differential: 16.403225806451612 },
  { playerId: 'mitch', date: '2024-06-28', course: 'Waratah',          score: 89, rating: 70, slope: 129, differential: 16.643410852713178 },
  { playerId: 'mitch', date: '2024-07-19', course: 'Wyong',            score: 89, rating: 71, slope: 123, differential: 16.536585365853657 },
  { playerId: 'mitch', date: '2024-08-02', course: 'The Springs',      score: 91, rating: 71, slope: 127, differential: 17.79527559055118 },
  { playerId: 'mitch', date: '2024-09-20', course: 'Shortland Waters', score: 91, rating: 71, slope: 130, differential: 17.384615384615383 },
  { playerId: 'mitch', date: '2024-10-15', course: 'Kooindah Waters',  score: 100, rating: 72, slope: 139, differential: 22.762589928057555 },
  { playerId: 'mitch', date: '2024-11-15', course: 'Wyong',            score: 79, rating: 71, slope: 123, differential: 7.349593495934959 },
  { playerId: 'mitch', date: '2024-12-05', course: 'Nelson Bay',       score: 103, rating: 71, slope: 125, differential: 28.928 },
  { playerId: 'mitch', date: '2025-01-14', course: 'Shortland Waters', score: 88, rating: 71, slope: 130, differential: 14.776923076923078 },
  { playerId: 'mitch', date: '2025-02-21', course: 'Kooindah Waters',  score: 92, rating: 72, slope: 139, differential: 16.258992805755394 },
  { playerId: 'mitch', date: '2025-03-14', course: 'Kooindah Waters',  score: 88, rating: 72, slope: 139, differential: 13.007194244604317 },
  { playerId: 'mitch', date: '2025-04-08', course: 'Waratah',          score: 80, rating: 70, slope: 129, differential: 8.75968992248062 },
  { playerId: 'mitch', date: '2025-05-15', course: 'Hunter Valley',    score: 96, rating: 70, slope: 126, differential: 23.317460317460316 },
  { playerId: 'mitch', date: '2025-06-27', course: 'The Springs',      score: 85, rating: 71, slope: 127, differential: 12.456692913385826 },
  { playerId: 'mitch', date: '2025-07-10', course: 'Magenta',          score: 96, rating: 72, slope: 135, differential: 20.08888888888889 },
  { playerId: 'mitch', date: '2025-08-28', course: 'Toukley',          score: 95, rating: 72, slope: 124, differential: 20.95967741935484 },
  { playerId: 'mitch', date: '2025-09-26', course: 'Belmont',          score: 95, rating: 72, slope: 125, differential: 20.792 },
  { playerId: 'mitch', date: '2026-01-27', course: 'Magenta',          score: 102, rating: 73, slope: 135, differential: 24.274074074074075 },
  { playerId: 'mitch', date: '2026-05-08', course: 'Toronto',          score: 93, rating: 69, slope: 128, differential: 21.1875 },
  { playerId: 'mitch', date: '2026-06-01', course: 'Shortland Waters', score: 96, rating: 72, slope: 128, differential: 21.1875 },

  { playerId: 'colby', date: '2024-05-16', course: 'Toukley',          score: 90, rating: 72, slope: 124, differential: 16.403225806451612 },
  { playerId: 'colby', date: '2024-06-28', course: 'Waratah',          score: 103, rating: 70, slope: 129, differential: 28.906976744186046 },
  { playerId: 'colby', date: '2024-07-19', course: 'Wyong',            score: 101, rating: 71, slope: 123, differential: 27.5609756097561 },
  { playerId: 'colby', date: '2024-08-02', course: 'The Springs',      score: 105, rating: 71, slope: 127, differential: 30.251968503937007 },
  { playerId: 'colby', date: '2024-09-20', course: 'Shortland Waters', score: 100, rating: 71, slope: 130, differential: 25.20769230769231 },
  { playerId: 'colby', date: '2024-10-15', course: 'Kooindah Waters',  score: 110, rating: 72, slope: 139, differential: 30.892086330935253 },
  { playerId: 'colby', date: '2024-11-15', course: 'Wyong',            score: 96, rating: 71, slope: 123, differential: 22.96747967479675 },
  { playerId: 'colby', date: '2024-12-05', course: 'Nelson Bay',       score: 92, rating: 71, slope: 125, differential: 18.984 },
  { playerId: 'colby', date: '2025-01-14', course: 'Shortland Waters', score: 95, rating: 71, slope: 130, differential: 20.861538461538462 },
  { playerId: 'colby', date: '2025-02-21', course: 'Kooindah Waters',  score: 89, rating: 72, slope: 139, differential: 13.820143884892087 },
  { playerId: 'colby', date: '2025-03-14', course: 'Kooindah Waters',  score: 90, rating: 72, slope: 139, differential: 14.633093525179856 },
  { playerId: 'colby', date: '2025-04-08', course: 'Waratah',          score: 90, rating: 70, slope: 129, differential: 17.51937984496124 },
  { playerId: 'colby', date: '2025-05-15', course: 'Hunter Valley',    score: 93, rating: 70, slope: 126, differential: 20.626984126984127 },
  { playerId: 'colby', date: '2025-06-27', course: 'The Springs',      score: 97, rating: 71, slope: 127, differential: 23.133858267716537 },
  { playerId: 'colby', date: '2025-07-10', course: 'Magenta',          score: 92, rating: 72, slope: 135, differential: 16.74074074074074 },
  { playerId: 'colby', date: '2025-08-28', course: 'Toukley',          score: 98, rating: 72, slope: 124, differential: 23.693548387096776 },
  { playerId: 'colby', date: '2025-09-26', course: 'Belmont',          score: 92, rating: 72, slope: 125, differential: 18.08 },
  { playerId: 'colby', date: '2026-01-27', course: 'Magenta',          score: 97, rating: 73, slope: 135, differential: 20.08888888888889 },
  { playerId: 'colby', date: '2026-05-08', course: 'Toronto',          score: 90, rating: 69, slope: 128, differential: 18.5390625 },
  { playerId: 'colby', date: '2026-06-01', course: 'Shortland Waters', score: 92, rating: 72, slope: 128, differential: 17.65625 },

  { playerId: 'scott', date: '2024-05-16', course: 'Toukley',          score: 100, rating: 72, slope: 124, differential: 25.516129032258064 },
  { playerId: 'scott', date: '2024-06-28', course: 'Waratah',          score: 94, rating: 70, slope: 129, differential: 21.023255813953487 },
  { playerId: 'scott', date: '2024-07-19', course: 'Wyong',            score: 99, rating: 71, slope: 123, differential: 25.723577235772357 },
  { playerId: 'scott', date: '2024-08-02', course: 'The Springs',      score: 105, rating: 71, slope: 127, differential: 30.251968503937007 },
  { playerId: 'scott', date: '2024-09-20', course: 'Shortland Waters', score: 97, rating: 71, slope: 130, differential: 22.6 },
  { playerId: 'scott', date: '2024-10-15', course: 'Kooindah Waters',  score: 100, rating: 72, slope: 139, differential: 22.762589928057555 },
  { playerId: 'scott', date: '2024-11-15', course: 'Wyong',            score: 98, rating: 71, slope: 123, differential: 24.804878048780488 },
  { playerId: 'scott', date: '2024-12-05', course: 'Nelson Bay',       score: 94, rating: 71, slope: 125, differential: 20.792 },
  { playerId: 'scott', date: '2025-01-14', course: 'Shortland Waters', score: 96, rating: 71, slope: 130, differential: 21.73076923076923 },
  { playerId: 'scott', date: '2025-02-21', course: 'Kooindah Waters',  score: 115, rating: 72, slope: 139, differential: 34.9568345323741 },
  { playerId: 'scott', date: '2025-03-14', course: 'Kooindah Waters',  score: 96, rating: 72, slope: 139, differential: 19.510791366906474 },
  { playerId: 'scott', date: '2025-04-08', course: 'Waratah',          score: 95, rating: 70, slope: 129, differential: 21.899224806201552 },
  { playerId: 'scott', date: '2025-05-15', course: 'Hunter Valley',    score: 97, rating: 70, slope: 126, differential: 24.214285714285715 },
  { playerId: 'scott', date: '2025-06-27', course: 'The Springs',      score: 105, rating: 71, slope: 127, differential: 30.251968503937007 },
  { playerId: 'scott', date: '2025-07-10', course: 'Magenta',          score: 104, rating: 72, slope: 135, differential: 26.785185185185185 },
  { playerId: 'scott', date: '2025-08-28', course: 'Toukley',          score: 99, rating: 72, slope: 124, differential: 24.60483870967742 },
  { playerId: 'scott', date: '2025-09-26', course: 'Belmont',          score: 97, rating: 72, slope: 125, differential: 22.6 },
  { playerId: 'scott', date: '2026-01-27', course: 'Magenta',          score: 104, rating: 73, slope: 135, differential: 25.94814814814815 },
  { playerId: 'scott', date: '2026-05-08', course: 'Toronto',          score: 98, rating: 69, slope: 128, differential: 25.6015625 },
  { playerId: 'scott', date: '2026-06-01', course: 'Shortland Waters', score: 110, rating: 72, slope: 128, differential: 33.546875 },

  { playerId: 'dave', date: '2024-05-16', course: 'Toukley',           score: 87, rating: 72, slope: 124, differential: 13.669354838709678 },
  { playerId: 'dave', date: '2024-06-28', course: 'Waratah',           score: 96, rating: 70, slope: 129, differential: 22.775193798449614 },
  { playerId: 'dave', date: '2024-07-19', course: 'Wyong',             score: 92, rating: 71, slope: 123, differential: 19.29268292682927 },
  { playerId: 'dave', date: '2024-08-02', course: 'The Springs',       score: 96, rating: 71, slope: 127, differential: 22.244094488188978 },
  { playerId: 'dave', date: '2024-09-20', course: 'Shortland Waters',  score: 95, rating: 71, slope: 130, differential: 20.861538461538462 },
  { playerId: 'dave', date: '2024-10-15', course: 'Kooindah Waters',   score: 92, rating: 72, slope: 139, differential: 16.258992805755394 },
  { playerId: 'dave', date: '2024-11-15', course: 'Wyong',             score: 91, rating: 71, slope: 123, differential: 18.3739837398374 },
  { playerId: 'dave', date: '2024-12-05', course: 'Nelson Bay',        score: 87, rating: 71, slope: 125, differential: 14.464 },
  { playerId: 'dave', date: '2025-01-14', course: 'Shortland Waters',  score: 86, rating: 71, slope: 130, differential: 13.038461538461538 },
  { playerId: 'dave', date: '2025-02-21', course: 'Kooindah Waters',   score: 98, rating: 72, slope: 139, differential: 21.136690647482013 },
  { playerId: 'dave', date: '2025-03-14', course: 'Kooindah Waters',   score: 96, rating: 72, slope: 139, differential: 19.510791366906474 },
  { playerId: 'dave', date: '2025-04-08', course: 'Waratah',           score: 87, rating: 70, slope: 129, differential: 14.891472868217054 },
  { playerId: 'dave', date: '2025-05-15', course: 'Hunter Valley',     score: 90, rating: 70, slope: 126, differential: 17.936507936507937 },
  { playerId: 'dave', date: '2025-06-27', course: 'The Springs',       score: 97, rating: 71, slope: 127, differential: 23.133858267716537 },
  { playerId: 'dave', date: '2025-07-10', course: 'Magenta',           score: 98, rating: 72, slope: 135, differential: 21.762962962962963 },
  { playerId: 'dave', date: '2025-08-28', course: 'Toukley',           score: 96, rating: 72, slope: 124, differential: 21.870967741935484 },
  { playerId: 'dave', date: '2025-09-26', course: 'Belmont',           score: 88, rating: 72, slope: 125, differential: 14.464 },
  { playerId: 'dave', date: '2026-01-27', course: 'Magenta',           score: 92, rating: 73, slope: 135, differential: 15.903703703703703 },
  { playerId: 'dave', date: '2026-05-08', course: 'Toronto',           score: 91, rating: 69, slope: 128, differential: 19.421875 },
  { playerId: 'dave', date: '2026-06-01', course: 'Shortland Waters',  score: 103, rating: 72, slope: 128, differential: 27.3671875 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN — no DB writes]\n');

  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // ── Rounds ────────────────────────────────────────────────────────────────

  console.log(`Upserting ${ROUNDS.length} rounds...`);
  for (const round of ROUNDS) {
    process.stdout.write(`  [${round.id}] ${round.label} (${round.date.slice(0,10)}) → `);
    if (dryRun) { console.log('skip (dry-run)'); continue; }
    const { error } = await supabase.from('rounds').upsert(round);
    console.log(error ? `ERROR: ${error.message}` : 'ok');
  }

  // ── Tour events ───────────────────────────────────────────────────────────

  console.log(`\nUpserting ${TOUR_EVENTS.length} tour_events...`);
  for (const ev of TOUR_EVENTS) {
    process.stdout.write(`  [${ev.id}] ${ev.month} → `);
    if (dryRun) { console.log('skip (dry-run)'); continue; }
    const { error } = await supabase.from('tour_events').upsert(ev);
    console.log(error ? `ERROR: ${error.message}` : 'ok');
  }

  // ── Handicap scores ───────────────────────────────────────────────────────

  console.log(`\nUpserting ${HANDICAP_SCORES.length} handicap_scores...`);
  const rows = HANDICAP_SCORES.map(s => ({
    id:           `${s.playerId}-${s.date}`,
    player_id:    s.playerId,
    date:         s.date,
    course:       s.course,
    score:        s.score,
    rating:       s.rating,
    slope:        s.slope,
    differential: s.differential,
    source:       'import',
  }));
  if (!dryRun) {
    const { error } = await supabase
      .from('handicap_scores')
      .upsert(rows, { onConflict: 'player_id,date' });
    if (error) console.log(`  ERROR: ${error.message}`);
    else console.log(`  ${rows.length} rows ok`);
  } else {
    console.log(`  ${rows.length} rows would be upserted (dry-run)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  if (!dryRun) {
    const { count: rc } = await supabase.from('rounds').select('*', { count: 'exact', head: true });
    const { count: ec } = await supabase.from('tour_events').select('*', { count: 'exact', head: true });
    const { count: hc } = await supabase.from('handicap_scores').select('*', { count: 'exact', head: true });
    console.log(`\nDB totals: rounds=${rc} tour_events=${ec} handicap_scores=${hc}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
