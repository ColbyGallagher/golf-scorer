'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../../store/gameStore';
import GameNav from '../_components/GameNav';
import HoleDots from './_components/HoleDots';
import HoleMeta from './_components/HoleMeta';
import CompBanner from './_components/CompBanner';
import WolfHoleSection from './_components/WolfHoleSection';
import ScoreGrid from './_components/ScoreGrid';

export default function GamePage() {
  const router      = useRouter();
  const gameActive  = useGameStore(s => s.gameActive);
  const currentHole = useGameStore(s => s.currentHole);
  const courseName  = useGameStore(s => s.courseName);
  const pars        = useGameStore(s => s.pars);
  const setCurrentHole = useGameStore(s => s.setCurrentHole);

  useEffect(() => {
    if (!gameActive) router.replace('/setup');
  }, [gameActive, router]);

  if (!gameActive) return null;

  const par = pars[currentHole];
  const coursePar = pars.reduce((a, b) => a + b, 0);

  function prev() { if (currentHole > 0)  setCurrentHole(currentHole - 1); }
  function next() { if (currentHole < 17) setCurrentHole(currentHole + 1); }

  return (
    <>
    <GameNav />
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: 'var(--gold)' }}>
            {courseName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Par {coursePar}
          </div>
        </div>
        <button
          onClick={() => router.push('/setup')}
          style={{ padding: '5px 11px', background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.28)', borderRadius: 8, color: '#ff7070', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          End
        </button>
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
    </>
  );
}
