import { supabase } from './supabase';
import type { TeeHole } from './db';

export interface ScanResult {
  courseName: string;
  confidence?: number;
  tees: Record<string, TeeHole[]>;
  duplicateWarnings?: Record<string, number[]>; // tee name → hole numbers (1-based) with duplicate SI
}

const SCAN_PROMPT = `This is a golf scorecard. Extract hole data for ALL available tee colours.
Return ONLY valid JSON in this exact format:
{"courseName":"Course name","confidence":85,"tees":{"yellow":[{"hole":1,"par":4,"indices":[7,25,43],"distance":350},...],"white":[...]}}
Rules:
- Only include tees that actually appear on the scorecard
- par is 3, 4, or 5
- indices: array of ALL stroke index values shown for that hole. Scorecards often show multiple SI tiers (e.g. "1/19/37" in one cell, or separate SI/SI2/Men/Ladies columns). List ALL found values, lowest first. If only one SI shown, use a single-element array like [7].
- distance in metres/yards if shown, else 0
- Each tee must have all 18 holes combined in order 1–18
- Tee key names must be lowercase: yellow, white, blue, red, black, gold, etc.
- confidence: integer 0-100 (100=perfectly legible, 50=some values uncertain, 0=unreadable). Lower it for blurry images, obscured cells, or any value you are guessing.
- Make best guess for any unclear values; lower confidence accordingly`;

interface RawHole {
  hole: number;
  par: number;
  indices?: number[];
  index?: number;
  distance?: number;
}

interface RawScanResponse {
  courseName: string;
  confidence?: number;
  tees: Record<string, RawHole[]>;
}

function findDuplicateSIs(holes: TeeHole[]): number[] {
  const siToHoles: Record<number, number[]> = {};
  holes.forEach((h, i) => {
    const si = h.indices?.[0] ?? h.index;
    if (siToHoles[si] == null) siToHoles[si] = [];
    siToHoles[si].push(i + 1);
  });
  const dupes: number[] = [];
  for (const holeNums of Object.values(siToHoles)) {
    if (holeNums.length > 1) dupes.push(...holeNums);
  }
  return [...new Set(dupes)].sort((a, b) => a - b);
}

// In production (GitHub Pages) this points to the Cloudflare Worker; locally it hits the Next.js API route.
const SCAN_URL = process.env.NEXT_PUBLIC_SCAN_URL || '/api/scan';

async function callScanAPI(base64Data: string, mimeType: string): Promise<ScanResult> {
  const response = await fetch(SCAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
          { type: 'text', text: SCAN_PROMPT },
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API error');

  const text = (data.content as { type: string; text: string }[])
    .filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON returned from scan');

  const raw = JSON.parse(jsonMatch[0]) as RawScanResponse;

  // Normalise: each hole gets index (primary SI) and indices array
  const tees: Record<string, TeeHole[]> = {};
  for (const [teeName, holes] of Object.entries(raw.tees)) {
    tees[teeName] = holes.map(h => {
      const allIndices: number[] = h.indices?.length ? h.indices : [h.index ?? 0];
      return { par: h.par, index: allIndices[0], indices: allIndices };
    });
  }

  return { courseName: raw.courseName, confidence: raw.confidence, tees };
}

export async function scanScorecardImage(base64Data: string, mimeType: string): Promise<ScanResult> {
  const result = await callScanAPI(base64Data, mimeType);

  // Check for duplicate primary SIs within each tee set
  const dupesFirst: Record<string, number[]> = {};
  let hasDuplicates = false;
  for (const [tee, holes] of Object.entries(result.tees)) {
    const dupes = findDuplicateSIs(holes);
    if (dupes.length) { dupesFirst[tee] = dupes; hasDuplicates = true; }
  }

  if (!hasDuplicates) return result;

  // Retry once
  const retry = await callScanAPI(base64Data, mimeType);
  const dupesRetry: Record<string, number[]> = {};
  for (const [tee, holes] of Object.entries(retry.tees)) {
    const dupes = findDuplicateSIs(holes);
    if (dupes.length) dupesRetry[tee] = dupes;
  }

  if (Object.keys(dupesRetry).length === 0) return retry;

  // Still duplicates after retry — return with warnings so UI can flag them
  return { ...retry, duplicateWarnings: dupesRetry };
}

export async function saveScorecardToCloud(
  courseName: string,
  selectedTee: string,
  tees: Record<string, TeeHole[]>,
  imageFile: File,
): Promise<void> {
  let imagePath: string | null = null;
  try {
    const ext = imageFile.type === 'image/png' ? 'png' : 'jpg';
    const filename = `scorecards/${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('scorecard-images')
      .upload(filename, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) console.error('Image upload failed:', uploadError);
    else imagePath = uploadData.path;
  } catch (e) {
    console.error('Image upload failed:', e);
  }

  const { error } = await supabase.from('scorecards').insert({
    course_name: courseName,
    selected_tee: selectedTee,
    tees,
    image_path: imagePath,
  });
  if (error) console.error('Scorecard save failed:', error);
}
