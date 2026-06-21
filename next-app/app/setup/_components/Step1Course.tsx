'use client';

import { useRef, useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { fetchSavedCourses } from '../../../lib/db';
import type { SavedCourse, TeeHole } from '../../../lib/db';
import { scanScorecardImage, saveScorecardToCloud } from '../../../lib/scan';
import type { ScanResult } from '../../../lib/scan';
import HoleConfirmTable from './HoleConfirmTable';

interface Props {
  onNext: () => void;
}

// Always resize + convert to JPEG so we never exceed Anthropic's 5MB image limit
// (iPhone photos can be 4–8 MB; HEIC has no native browser support)
const MAX_PX = 2000;

async function normalizeImage(dataUrl: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ base64: jpeg.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Could not read image — try a JPEG or PNG photo'));
    img.src = dataUrl;
  });
}

const TEE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  yellow: { bg: 'rgba(255,215,0,0.18)',   border: 'rgba(255,215,0,0.6)',    color: '#ffe566' },
  white:  { bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.5)',  color: '#f5f0e8' },
  red:    { bg: 'rgba(224,85,85,0.15)',   border: 'rgba(224,85,85,0.5)',    color: '#e05555' },
  blue:   { bg: 'rgba(85,153,204,0.15)',  border: 'rgba(85,153,204,0.5)',   color: '#88bbee' },
  black:  { bg: 'rgba(30,30,30,0.5)',     border: 'rgba(180,180,180,0.4)',  color: '#d0ccc6' },
};

export default function Step1Course({ onNext }: Props) {
  const courseName       = useGameStore(s => s.courseName);
  const pars             = useGameStore(s => s.pars);
  const indices          = useGameStore(s => s.indices);
  const teeApplied       = useGameStore(s => s.teeApplied);
  const holesConfirmed   = useGameStore(s => s.holesConfirmed);
  const setCourseName    = useGameStore(s => s.setCourseName);
  const setPars          = useGameStore(s => s.setPars);
  const setIndices       = useGameStore(s => s.setIndices);
  const setTeeApplied    = useGameStore(s => s.setTeeApplied);
  const setHolesConfirmed = useGameStore(s => s.setHolesConfirmed);
  const setSelectedTee   = useGameStore(s => s.setSelectedTee);

  // Course library search
  const [allCourses,   setAllCourses]   = useState<SavedCourse[]>([]);
  const [courseQuery,  setCourseQuery]  = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Scan result (from library or photo scan)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanFile,   setScanFile]   = useState<File | null>(null);
  const [scanSaved,  setScanSaved]  = useState(false);

  // Scan status
  const [scanning,  setScanning]  = useState(false);
  const [scanMsg,   setScanMsg]   = useState('');
  const [scanError, setScanError] = useState('');

  // Applied tee name (for display after applying)
  const [appliedTee, setAppliedTee] = useState('');

  // Scan quality
  const [scanConfidence,    setScanConfidence]    = useState<number | undefined>(undefined);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, number[]>>({});

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);

  const courseHits = courseQuery
    ? allCourses.filter(c => c.course_name.toLowerCase().includes(courseQuery.toLowerCase()))
    : allCourses;

  const canProceed = teeApplied && holesConfirmed;

  // ── Course library ──────────────────────────────────────────────────────────

  async function handleSearchFocus() {
    if (allCourses.length === 0) {
      const courses = await fetchSavedCourses();
      setAllCourses(courses);
    }
    setShowDropdown(true);
  }

  function selectCourse(course: SavedCourse) {
    setCourseName(course.course_name);
    setCourseQuery('');
    setShowDropdown(false);
    setScanResult({ courseName: course.course_name, tees: course.tees });
    setScanFile(null);
    setScanSaved(true); // already in the library — no need to save again
    setTeeApplied(false);
    setHolesConfirmed(false);
    setAppliedTee('');
    setScanConfidence(undefined);
    setDuplicateWarnings({});
    setScanMsg(`✅ ${course.course_name} loaded from library`);
    setScanError('');
  }

  // ── Photo scan ──────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setScanResult(null);
    setScanFile(file);
    setScanSaved(false);
    setTeeApplied(false);
    setHolesConfirmed(false);
    setAppliedTee('');
    setScanError('');
    setScanConfidence(undefined);
    setDuplicateWarnings({});
    setScanning(true);
    setScanMsg('🔍 Reading scorecard…');

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { base64, mimeType } = await normalizeImage(dataUrl);
      const result = await scanScorecardImage(base64, mimeType);
      const validTees = Object.fromEntries(
        Object.entries(result.tees).filter(([, holes]) => holes.length === 18)
      );
      if (Object.keys(validTees).length === 0) {
        throw new Error('Could not read any tee data — try a clearer photo');
      }

      if (result.courseName) setCourseName(result.courseName);
      setScanResult({ ...result, tees: validTees });
      setScanConfidence(result.confidence);
      // Filter duplicate warnings to only tees that passed the 18-hole check
      const filteredWarnings = Object.fromEntries(
        Object.entries(result.duplicateWarnings ?? {}).filter(([tee]) => tee in validTees)
      );
      setDuplicateWarnings(filteredWarnings);
      const teeCount = Object.keys(validTees).length;
      const confLabel = result.confidence != null ? ` · Confidence: ${result.confidence}%` : '';
      setScanMsg(`✅ ${result.courseName || 'Scorecard'} scanned · ${teeCount} tee set${teeCount !== 1 ? 's' : ''} found${confLabel}`);
    } catch (err) {
      setScanError(`⚠️ ${err instanceof Error ? err.message : 'Scan failed'}. Adjust manually below if needed.`);
      setScanMsg('');
      setTeeApplied(true); // let them proceed with manual entry
    } finally {
      setScanning(false);
    }
  }

  // ── Tee selection ───────────────────────────────────────────────────────────

  async function applyTee(teeName: string) {
    if (!scanResult) return;
    const holes = scanResult.tees[teeName];
    if (!holes || holes.length !== 18) return;

    setPars(holes.map((h: TeeHole) => h.par));
    setIndices(holes.map((h: TeeHole) => h.index));
    setSelectedTee(teeName);
    setTeeApplied(true);
    setAppliedTee(teeName);
    setHolesConfirmed(false);

    // Save new scans to the cloud (once)
    if (!scanSaved && scanFile) {
      setScanSaved(true);
      saveScorecardToCloud(
        scanResult.courseName || courseName,
        teeName,
        scanResult.tees,
        scanFile,
      ).catch(console.error);
    }
  }

  // ── Hole edits ──────────────────────────────────────────────────────────────

  function handleParChange(hole: number, val: number) {
    const next = [...pars]; next[hole] = val; setPars(next);
  }

  function handleIdxChange(hole: number, val: number) {
    const next = [...indices]; next[hole] = val; setIndices(next);
  }

  function handleUseDefaults() {
    setScanResult(null);
    setTeeApplied(true);
    setHolesConfirmed(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="card">
        <div className="card-title">⛳ Course & Scorecard</div>

        {/* Course library search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search course library…"
            value={courseQuery}
            onChange={e => setCourseQuery(e.target.value)}
            onFocus={handleSearchFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            style={{
              width: '100%', padding: '8px 11px', boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 8, color: 'var(--cream)',
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: 'none',
            }}
          />
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#1a2412', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              {courseHits.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: 'rgba(245,240,232,0.3)', textAlign: 'center' }}>
                  {courseQuery ? 'No matching courses' : 'No saved courses yet'}
                </div>
              ) : courseHits.map(c => {
                const teeNames = Object.keys(c.tees || {});
                const date = new Date(c.scanned_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div
                    key={c.id}
                    onMouseDown={() => selectCourse(c)}
                    style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(78,186,122,0.09)')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.course_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginTop: 2 }}>
                      {teeNames.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ')} · {date}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Course name */}
        <input
          type="text"
          placeholder="Course name"
          value={courseName}
          onChange={e => setCourseName(e.target.value)}
          style={{
            width: '100%', padding: '8px 11px', marginBottom: 10, boxSizing: 'border-box',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 8, color: 'var(--cream)',
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: 'none',
          }}
        />

        {/* Scan status / error */}
        {(scanMsg || scanError) && (
          <div style={{
            padding: '8px 11px', marginBottom: 10, borderRadius: 8, fontSize: 12,
            background: scanError ? 'rgba(224,85,85,0.1)' : 'rgba(78,186,122,0.12)',
            color: scanError ? 'var(--red)' : 'var(--green-bright)',
            border: `1px solid ${scanError ? 'rgba(224,85,85,0.3)' : 'rgba(78,186,122,0.25)'}`,
          }}>
            {scanError || scanMsg}
          </div>
        )}

        {/* Photo buttons */}
        <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 8 }}>
          Take a photo of the scorecard — AI reads all tee data, then pick your tees.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            className="btn-primary"
            style={{ marginBottom: 0 }}
            disabled={scanning}
            onClick={() => galleryInputRef.current?.click()}
          >
            {scanning ? '⏳ Scanning…' : '🖼️ Choose Photo'}
          </button>
          <button
            className="btn-primary"
            style={{ marginBottom: 0 }}
            disabled={scanning}
            onClick={() => cameraInputRef.current?.click()}
          >
            📷 Take Photo
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />

        {/* Tee picker */}
        {scanResult && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.5)', marginBottom: 6 }}>Pick your tees:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(scanResult.tees).map(teeName => {
                const s = TEE_STYLES[teeName] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', color: 'var(--cream)' };
                const isSelected = teeName === appliedTee;
                const hasDupes = !!duplicateWarnings[teeName];
                return (
                  <button
                    key={teeName}
                    onClick={() => applyTee(teeName)}
                    style={{
                      padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: isSelected ? s.border : s.bg,
                      border: `2px solid ${isSelected ? s.color : s.border}`,
                      color: isSelected ? '#111' : s.color,
                      boxShadow: isSelected ? `0 0 8px ${s.border}` : 'none',
                    }}
                  >
                    {teeName.charAt(0).toUpperCase() + teeName.slice(1)}{hasDupes ? ' ⚠️' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback: use defaults */}
        {!teeApplied && !scanResult && (
          <button
            className="btn-secondary"
            style={{ width: '100%', marginTop: 4 }}
            onClick={handleUseDefaults}
          >
            Use default hole data (Shortland Waters)
          </button>
        )}
      </div>

      {/* Hole confirmation */}
      {teeApplied && (
        <div className="card">
          <div className="card-title">📋 Confirm Holes</div>
          {duplicateWarnings[appliedTee] && (
            <div style={{
              padding: '8px 11px', marginBottom: 10, borderRadius: 8, fontSize: 12,
              background: 'rgba(224,85,85,0.1)', color: 'var(--red)',
              border: '1px solid rgba(224,85,85,0.3)',
            }}>
              ⚠️ Duplicate stroke indices detected on holes {duplicateWarnings[appliedTee].join(', ')} — please verify below.
            </div>
          )}
          <HoleConfirmTable
            pars={pars}
            indices={indices}
            onParChange={handleParChange}
            onIdxChange={handleIdxChange}
          />
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.3)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 8 }}>
              ⚠️ Check that pars and stroke indices are correct — errors here affect all scoring and handicap calculations.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={holesConfirmed}
                onChange={e => setHolesConfirmed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--green-bright)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--cream)' }}>Pars and stroke indices are correct</span>
            </label>
          </div>
        </div>
      )}

      <button className="btn-primary" disabled={!canProceed} onClick={onNext}>
        Next — Game Format →
      </button>
    </div>
  );
}
