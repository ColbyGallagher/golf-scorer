'use client';

import { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { fetchSavedCourses, updateScorecard } from '../../../lib/db';

interface ConflictColor {
  bg:     string;
  border: string;
  text:   string;
  hole:   string;
}

const CONFLICT_COLORS: ConflictColor[] = [
  { bg: 'rgba(224,85,85,0.18)',    border: 'rgba(224,85,85,0.7)',    text: '#e86060', hole: 'rgba(224,85,85,0.9)'    },
  { bg: 'rgba(200,130,40,0.18)',   border: 'rgba(200,130,40,0.7)',   text: '#d48830', hole: 'rgba(200,130,40,0.9)'   },
  { bg: 'rgba(140,80,200,0.18)',   border: 'rgba(140,80,200,0.7)',   text: '#a070d0', hole: 'rgba(140,80,200,0.9)'   },
  { bg: 'rgba(40,160,200,0.18)',   border: 'rgba(40,160,200,0.7)',   text: '#30a8d0', hole: 'rgba(40,160,200,0.9)'   },
  { bg: 'rgba(200,80,140,0.18)',   border: 'rgba(200,80,140,0.7)',   text: '#d060a0', hole: 'rgba(200,80,140,0.9)'   },
];

function buildConflictMap(indices: number[]): Record<number, ConflictColor> {
  const groups: Record<number, number[]> = {};
  indices.forEach((si, h) => {
    if (!groups[si]) groups[si] = [];
    groups[si].push(h);
  });
  const map: Record<number, ConflictColor> = {};
  let ci = 0;
  Object.values(groups).forEach(holes => {
    if (holes.length > 1) {
      const color = CONFLICT_COLORS[ci % CONFLICT_COLORS.length];
      holes.forEach(h => { map[h] = color; });
      ci++;
    }
  });
  return map;
}

interface Props {
  onClose: () => void;
}

export default function EditCourseModal({ onClose }: Props) {
  const pars        = useGameStore(s => s.pars);
  const indices     = useGameStore(s => s.indices);
  const setPars     = useGameStore(s => s.setPars);
  const setIndices  = useGameStore(s => s.setIndices);
  const courseName  = useGameStore(s => s.courseName);
  const selectedTee = useGameStore(s => s.selectedTee);

  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');

  const conflictMap = buildConflictMap(indices);
  const hasDupes    = Object.keys(conflictMap).length > 0;
  const totalPar    = pars.reduce((a, b) => a + b, 0);

  function adjustPar(h: number, delta: number) {
    const next = [...pars];
    next[h] = Math.max(3, Math.min(5, pars[h] + delta));
    setPars(next);
    if (saveState === 'idle') setSaveState('pending');
  }

  function adjustSI(h: number, delta: number) {
    const next = [...indices];
    next[h] = Math.max(1, Math.min(18, indices[h] + delta));
    setIndices(next);
    if (saveState === 'idle') setSaveState('pending');
  }

  async function saveToLibrary() {
    setSaveState('saving');
    try {
      const courses = await fetchSavedCourses();
      const course  = courses.find(
        c => c.course_name.trim().toLowerCase() === courseName.trim().toLowerCase(),
      );
      if (!course) { setSaveState('error'); return; }

      const teeKey      = selectedTee.toLowerCase();
      const updatedTees = { ...course.tees };
      if (updatedTees[teeKey]) {
        updatedTees[teeKey] = updatedTees[teeKey].map((h, i) => ({
          ...h, par: pars[i], index: indices[i],
        }));
      }
      const result = await updateScorecard(course.id, courseName, updatedTees);
      if (result === 'saved') {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 3000);
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px 12px 32px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2412', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 14, width: '100%', maxWidth: 420,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: 'var(--gold)' }}>
              Edit Course
            </div>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 2 }}>
              {courseName} · {selectedTee.charAt(0).toUpperCase() + selectedTee.slice(1)} tees · Par {totalPar}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(245,240,232,0.5)', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* ── Column headers ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 1fr',
          gap: 8, padding: '10px 16px 4px',
          fontSize: 10, color: 'rgba(245,240,232,0.3)',
          textTransform: 'uppercase', letterSpacing: 1,
        }}>
          <span>#</span>
          <span style={{ textAlign: 'center' }}>Par</span>
          <span style={{ textAlign: 'center' }}>Stroke Index</span>
        </div>

        {/* ── Hole rows ── */}
        <div style={{ padding: '0 16px 8px' }}>
          {pars.map((par, h) => {
            const si      = indices[h];
            const conflict = conflictMap[h];
            const parColor = par === 3 ? 'var(--blue)' : par === 5 ? 'var(--gold)' : 'rgba(245,240,232,0.55)';

            return (
              <div
                key={h}
                style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 1fr',
                  gap: 8, alignItems: 'center',
                  padding: '5px 0',
                  borderBottom: h < 17 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                {/* Hole number */}
                <span style={{
                  fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
                  color: conflict ? conflict.hole : 'rgba(245,240,232,0.4)',
                }}>
                  {h + 1}
                </span>

                {/* Par control */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.15)',
                  borderRadius: 8, overflow: 'hidden',
                }}>
                  <button className="par-btn" style={{ width: 30, height: 30, fontSize: 16 }} onClick={() => adjustPar(h, -1)}>−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={par}
                    onChange={e => {
                      const v = parseInt(e.target.value.replace(/\D/g, ''));
                      if (!isNaN(v) && v >= 3 && v <= 5) {
                        const next = [...pars]; next[h] = v; setPars(next);
                        if (saveState === 'idle') setSaveState('pending');
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowUp')   { e.preventDefault(); adjustPar(h,  1); }
                      if (e.key === 'ArrowDown')  { e.preventDefault(); adjustPar(h, -1); }
                    }}
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                      color: parColor, width: 32, textAlign: 'center',
                      background: 'transparent', border: 'none', outline: 'none',
                    }}
                  />
                  <button className="par-btn" style={{ width: 30, height: 30, fontSize: 16 }} onClick={() => adjustPar(h, 1)}>+</button>
                </div>

                {/* SI control */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: conflict ? conflict.bg : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${conflict ? conflict.border : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  <button className="par-btn" style={{ width: 30, height: 30, fontSize: 16 }} onClick={() => adjustSI(h, -1)}>−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={si}
                    onChange={e => {
                      const v = parseInt(e.target.value.replace(/\D/g, ''));
                      if (!isNaN(v) && v >= 1 && v <= 18) {
                        const next = [...indices]; next[h] = v; setIndices(next);
                        if (saveState === 'idle') setSaveState('pending');
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowUp')   { e.preventDefault(); adjustSI(h,  1); }
                      if (e.key === 'ArrowDown')  { e.preventDefault(); adjustSI(h, -1); }
                    }}
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                      color: conflict ? conflict.text : 'var(--cream)',
                      width: 32, textAlign: 'center',
                      background: 'transparent', border: 'none', outline: 'none',
                    }}
                  />
                  <button className="par-btn" style={{ width: 30, height: 30, fontSize: 16 }} onClick={() => adjustSI(h, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 16px 18px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {hasDupes && (
            <div style={{
              padding: '7px 10px',
              background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 7, fontSize: 11, color: 'var(--red)',
            }}>
              ⚠️ Duplicate stroke indices — same colour = same conflict
            </div>
          )}

          {saveState === 'pending' && !hasDupes && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px',
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 7,
            }}>
              <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.55)', flex: 1 }}>Update course library?</span>
              <button
                onClick={saveToLibrary}
                style={{
                  padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                  background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
                  color: 'var(--gold)', fontSize: 11, fontWeight: 600,
                }}
              >Save</button>
              <button
                onClick={() => setSaveState('idle')}
                style={{
                  padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(245,240,232,0.1)',
                  color: 'rgba(245,240,232,0.35)', fontSize: 11,
                }}
              >✕</button>
            </div>
          )}

          {saveState === 'saving' && (
            <div style={{
              padding: '7px 10px',
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 7, fontSize: 11, color: 'rgba(245,240,232,0.5)',
            }}>Saving…</div>
          )}
          {saveState === 'saved' && (
            <div style={{
              padding: '7px 10px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 7, fontSize: 11, color: 'var(--green-bright)',
            }}>✓ Course library updated</div>
          )}
          {saveState === 'error' && (
            <div style={{
              padding: '7px 10px',
              background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)',
              borderRadius: 7, fontSize: 11, color: 'var(--red)',
            }}>Course not in library — changes apply to this round only</div>
          )}

          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
