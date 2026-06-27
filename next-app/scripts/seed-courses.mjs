#!/usr/bin/env node
/**
 * seed-courses.mjs — bulk-seed a region's golf courses into Supabase via GolfCourseAPI.
 *
 * Usage (run from next-app/ directory):
 *   node scripts/seed-courses.mjs [--region="New South Wales"] [--limit=45] [--dry-run]
 *
 * --region   OSM area name to query (default: "New South Wales")
 * --limit    Max API calls per run (default: 45, leaves headroom for live fallback)
 * --dry-run  Print what would happen, no API calls or DB writes
 *
 * Progress is saved to scripts/seed-queue.json between runs.
 * Resume by running the same command again — already-processed names are skipped.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── .env.local parser ────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const env = {};
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  } catch {
    console.error('Error: could not read .env.local — run this script from the next-app/ directory.');
    process.exit(1);
  }
  return env;
}

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length);
  return {
    region:  get('--region=') ?? 'New South Wales',
    limit:   parseInt(get('--limit=') ?? '45', 10),
    dryRun:  args.includes('--dry-run'),
  };
}

// ── Overpass: all golf course names in a named OSM region ────────────────────

async function fetchRegionCourseNames(region) {
  const query =
    `[out:json][timeout:90];` +
    `area["name"="${region}"]->.r;` +
    `(node["leisure"="golf_course"](area.r);` +
    ` way["leisure"="golf_course"](area.r);` +
    ` relation["leisure"="golf_course"](area.r););` +
    `out tags;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  console.log(`Querying Overpass for "${region}"...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  const names = (data.elements ?? [])
    .map(el => el.tags?.name)
    .filter(n => typeof n === 'string' && n.trim() && n.toLowerCase() !== 'golf course');
  return [...new Set(names)].sort();
}

// ── GolfCourseAPI ─────────────────────────────────────────────────────────────

async function apiFetchByName(name, apiKey) {
  const url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: `Key ${apiKey}` } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.courses?.length) return null;

  // Prefer exact normalized name match
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(name);
  return data.courses.find(c => norm(c.course_name || c.club_name || '') === target)
    ?? data.courses[0];
}

// ── Transform (self-contained copy of lib/courseApi.ts logic) ────────────────

function parseTeeColor(teeName) {
  const parts = teeName.split(', ');
  return (parts.length >= 3 ? parts[2] : teeName).toLowerCase().trim();
}

function transformApiCourse(api) {
  const tees = {};
  const seenKeys = new Set();
  for (const [gender, sets] of [['male', api.tees?.male ?? []], ['female', api.tees?.female ?? []]]) {
    for (const teeSet of sets) {
      if (teeSet.number_of_holes !== 18 || !teeSet.holes?.length) continue;
      let key = parseTeeColor(teeSet.tee_name);
      if (!key) continue;
      if (seenKeys.has(key)) key = gender === 'female' ? `${key} (ladies)` : `${key} 2`;
      seenKeys.add(key);
      // API has no stroke index — assign sequential 1–18 as editable placeholder
      tees[key] = teeSet.holes.map((h, i) => ({ par: h.par, index: h.handicap ?? (i + 1) }));
    }
  }
  return { course_name: api.course_name || api.club_name || 'Unknown', tees };
}

// ── Queue persistence ─────────────────────────────────────────────────────────

function loadQueue(queuePath, region) {
  if (fs.existsSync(queuePath)) {
    const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    if (q.region === region) return q;
    console.log(`Region changed from "${q.region}" → "${region}". Starting fresh queue.`);
  }
  return { region, names: [], processed: new Set(), failed: [] };
}

function saveQueue(queuePath, queue) {
  fs.writeFileSync(queuePath, JSON.stringify({
    ...queue,
    processed: [...queue.processed],
  }, null, 2));
}

function hydrateQueue(raw) {
  return { ...raw, processed: new Set(raw.processed ?? []) };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { region, limit, dryRun } = parseArgs();
  if (dryRun) console.log('[DRY RUN — no API calls or DB writes]');

  const env = loadEnv();
  const apiKey      = env.GOLF_COURSE_API_KEY;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey)                    { console.error('Missing GOLF_COURSE_API_KEY in .env.local');    process.exit(1); }
  if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars in .env.local');    process.exit(1); }

  const supabase   = createClient(supabaseUrl, supabaseKey);
  const queuePath  = path.join(process.cwd(), 'scripts', 'seed-queue.json');
  const rawQueue   = loadQueue(queuePath, region);
  const queue      = hydrateQueue(rawQueue);

  // Build name list from Overpass if queue is empty
  if (queue.names.length === 0) {
    if (dryRun) {
      console.log('(dry-run) Would query Overpass and build queue.');
      return;
    }
    queue.names = await fetchRegionCourseNames(region);
    console.log(`Found ${queue.names.length} courses in "${region}".`);
    saveQueue(queuePath, queue);
  }

  const pending = queue.names.filter(n => !queue.processed.has(n));
  console.log(`Queue: ${queue.names.length} total | ${queue.processed.size} done | ${pending.length} pending | limit ${limit}/run`);

  if (pending.length === 0) {
    console.log('All courses processed.');
    return;
  }

  let apiCalls = 0;
  let saved    = 0;
  let existed  = 0;
  let failed   = 0;

  for (const name of pending) {
    if (apiCalls >= limit) {
      console.log(`\nLimit of ${limit} API calls reached. Run again tomorrow to continue.`);
      break;
    }

    process.stdout.write(`  "${name}" → `);

    if (dryRun) {
      console.log('(dry-run) would fetch + save');
      apiCalls++;
      continue;
    }

    // Check Supabase first — free, no API quota used
    const { data: existing } = await supabase
      .from('scorecards')
      .select('id')
      .ilike('course_name', name)
      .limit(1);

    if (existing?.length) {
      console.log('already in library');
      queue.processed.add(name);
      existed++;
      saveQueue(queuePath, queue);
      continue;
    }

    // Fetch from GolfCourseAPI
    const api = await apiFetchByName(name, apiKey);
    apiCalls++;

    if (!api) {
      console.log('not found in API');
      queue.processed.add(name);
      queue.failed.push(name);
      failed++;
      saveQueue(queuePath, queue);
      await delay(300);
      continue;
    }

    const { course_name, tees } = transformApiCourse(api);

    if (Object.keys(tees).length === 0) {
      console.log('no 18-hole tee data');
      queue.processed.add(name);
      queue.failed.push(name);
      failed++;
      saveQueue(queuePath, queue);
      await delay(300);
      continue;
    }

    const { error } = await supabase.from('scorecards').insert({
      course_name,
      selected_tee: '',
      tees,
      image_path: null,
    });

    if (error) {
      console.log(`DB error: ${error.message}`);
      failed++;
      // Don't mark processed — transient DB errors can be retried
    } else {
      console.log(`saved [${Object.keys(tees).join(', ')}]`);
      queue.processed.add(name);
      saved++;
    }

    saveQueue(queuePath, queue);
    await delay(300);
  }

  const remaining = pending.length - apiCalls - existed;
  console.log(`\nSummary: ${apiCalls} API calls | ${saved} saved | ${existed} already existed | ${failed} failed`);
  if (remaining > 0) console.log(`${remaining} courses still pending — run again tomorrow.`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => { console.error(e); process.exit(1); });
