'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import { saveRoundToCloud } from '../../lib/db';
import type { HistoryRound } from '../../lib/db';
import type { PlayerId } from '../../lib/types';
import GameNav from '../_components/GameNav';
import HoleDots from './_components/HoleDots';
import HoleMeta from './_components/HoleMeta';
import CompBanner from './_components/CompBanner';
import WolfHoleSection from './_components/WolfHoleSection';
import ScoreGrid from './_components/ScoreGrid';
import EditCourseModal from './_components/EditCourseModal';

function loadHistory(): HistoryRound[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('golf_history') || '[]'); } catch { return []; }
}

export default function GamePage() {
  const router      = useRouter();
  const gameActive  = useGameStore(s => s.gameActive);
  const currentHole = useGameStore(s => s.currentHole);
  const courseName  = useGameStore(s => s.courseName);
  const pars        = useGameStore(s => s.pars);
  const scores      = useGameStore(s => s.scores);
  const indices     = useGameStore(s => s.indices);
  const handicaps   = useGameStore(s => s.handicaps);
  const teamAssignments = useGameStore(s => s.teamAssignments);
  const courseRating    = useGameStore(s => s.courseRating);
  const slopeRating     = useGameStore(s => s.slopeRating);
  const compWinners     = useGameStore(s => s.compWinners);
  const activeGames     = useGameStore(s => s.activeGames);
  const wolfOrder       = useGameStore(s => s.wolfOrder);
  const wolfHoles       = useGameStore(s => s.wolfHoles);
  const wolfOverrides   = useGameStore(s => s.wolfOverrides);
  const selectedTee     = useGameStore(s => s.selectedTee);
  const threePutts      = useGameStore(s => s.threePutts);
  const resetGame       = useGameStore(s => s.resetGame);
  const setCurrentHole  = useGameStore(s => s.setCurrentHole);

  const [showMenu,       setShowMenu]       = useState(false);
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [showEndModal,   setShowEndModal]   = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameActive) router.replace('/setup');
  }, [gameActive, router]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  if (!gameActive) return null;

  const coursePar   = pars.reduce((a, b) => a + b, 0);
  const holesPlayed = Array.from({ length: 18 }, (_, h) =>
    PLAYERS.some(p => scores[p.id as PlayerId][h] > 0),
  ).filter(Boolean).length;

  function prev() { if (currentHole > 0)  setCurrentHole(currentHole - 1); }
  function next() { if (currentHole < 17) setCurrentHole(currentHole + 1); }

  async function handleSaveAndExit() {
    setSaving(true);
    setSaveMsg('Saving…');

    const entry: HistoryRound = {
      id:              Date.now(),
      label:           courseName || 'Round',
      date:            new Date().toISOString(),
      holesPlayed,
      handicaps:       { ...handicaps },
      pars:            [...pars],
      indices:         [...indices],
      scores:          Object.fromEntries(PLAYERS.map(p => [p.id, [...scores[p.id as PlayerId]]])),
      compWinners:     JSON.parse(JSON.stringify(compWinners)),
      teamAssignments: { ...teamAssignments },
      activeGames:     { ...activeGames },
      wolfOrder:       [...wolfOrder],
      wolfHoles:       JSON.parse(JSON.stringify(wolfHoles)),
      wolfOverrides:   { ...wolfOverrides },
      courseName,
      courseRating,
      slopeRating,
      selectedTee,
      threePutts:      Object.fromEntries(PLAYERS.map(p => [p.id, [...(threePutts[p.id as PlayerId] ?? [])]])),
    };

    const hist = loadHistory();
    hist.unshift(entry);
    localStorage.setItem('golf_history', JSON.stringify(hist.slice(0, 50)));

    const result = await saveRoundToCloud(entry);
    setSaveMsg(result === 'saved' ? '✅ Saved!' : '⚠️ Cloud save failed — saved locally');
    setSaving(false);

    setTimeout(() => { resetGame(); }, 800);
  }

  function handleDiscard() { resetGame(); }

  return (
    <>
    <GameNav />
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: 'var(--gold)' }}>
            {courseName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Par {coursePar}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Hamburger menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                background: showMenu ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${showMenu ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: showMenu ? 'var(--gold)' : 'rgba(245,240,232,0.6)',
                fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >≡</button>

            {showMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                background: '#1a2412', border: '1px solid rgba(201,168,76,0.22)',
                borderRadius: 10, padding: '4px 0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                minWidth: 160,
              }}>
                <button
                  onClick={() => { setShowMenu(false); setShowEditCourse(true); }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--cream)', fontSize: 13, textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14 }}>✏️</span> Edit Course
                </button>
              </div>
            )}
          </div>

          {/* End button */}
          <button
            onClick={() => setShowEndModal(true)}
            style={{
              padding: '5px 11px', background: 'rgba(200,60,60,0.1)',
              border: '1px solid rgba(200,60,60,0.28)', borderRadius: 8,
              color: '#ff7070', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >End</button>
        </div>
      </div>

      <HoleDots currentHole={currentHole} onSelect={setCurrentHole} />

      <div className="hole-nav">
        <button className="hole-nav-btn" onClick={prev} disabled={currentHole === 0} style={{ opacity: currentHole === 0 ? 0.3 : 1 }}>‹</button>
        <div className="hole-info-center">
          <div className="hole-number">{currentHole + 1}</div>
          <div className="hole-label">Hole</div>
        </div>
        <button className="hole-nav-btn" onClick={next} disabled={currentHole === 17} style={{ opacity: currentHole === 17 ? 0.3 : 1 }}>›</button>
      </div>

      <HoleMeta hole={currentHole} />
      <CompBanner hole={currentHole} />
      <WolfHoleSection hole={currentHole} />
      <ScoreGrid hole={currentHole} />

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn-secondary" onClick={prev} disabled={currentHole === 0} style={{ opacity: currentHole === 0 ? 0.4 : 1 }}>
          ← Prev
        </button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={next} disabled={currentHole === 17}>
          {currentHole === 17 ? 'Last Hole' : 'Next →'}
        </button>
      </div>
    </div>

    {/* ── Edit Course modal ── */}
    {showEditCourse && <EditCourseModal onClose={() => setShowEditCourse(false)} />}

    {/* ── End round modal ── */}
    {showEndModal && (
      <div
        onClick={() => { if (!saving) setShowEndModal(false); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#1a2412', border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 14, padding: '24px 20px', width: '100%', maxWidth: 340,
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', marginBottom: 6 }}>
            End Round?
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', marginBottom: 4 }}>
            {courseName}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 20 }}>
            {holesPlayed} hole{holesPlayed !== 1 ? 's' : ''} scored
          </div>

          {saveMsg && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: 13, textAlign: 'center',
              background: saveMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(224,85,85,0.1)',
              color: saveMsg.startsWith('✅') ? 'var(--green-bright)' : 'var(--red)',
              border: `1px solid ${saveMsg.startsWith('✅') ? 'rgba(34,197,94,0.25)' : 'rgba(224,85,85,0.3)'}`,
            }}>
              {saveMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-primary"
              disabled={saving || holesPlayed === 0}
              onClick={handleSaveAndExit}
              style={{ opacity: holesPlayed === 0 ? 0.4 : 1 }}
            >
              {saving ? 'Saving…' : 'Save & Exit'}
            </button>
            <button
              onClick={handleDiscard}
              disabled={saving}
              style={{
                padding: '11px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)',
                color: '#ff7070',
              }}
            >Discard Round</button>
            <button
              onClick={() => setShowEndModal(false)}
              disabled={saving}
              style={{
                padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 12,
                background: 'transparent', border: '1px solid rgba(245,240,232,0.1)',
                color: 'rgba(245,240,232,0.35)',
              }}
            >Keep Playing</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
