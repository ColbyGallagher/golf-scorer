'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import type { PlayerId } from '../../lib/types';
import SetupStepper from './_components/SetupStepper';
import Step1Course from './_components/Step1Course';
import Step2GameFormat from './_components/Step2GameFormat';
import Step3Players from './_components/Step3Players';

const MENU_ITEMS = [
  { href: '/players',  label: '👤 Players'  },
  { href: '/history',  label: '📚 History'  },
  { href: '/tour',     label: '🏅 Tour'     },
  { href: '/courses',  label: '⛳ Courses'  },
];

export default function SetupPage() {
  const router       = useRouter();
  const setupStep    = useGameStore(s => s.setupStep);
  const setSetupStep = useGameStore(s => s.setSetupStep);
  const gameActive   = useGameStore(s => s.gameActive);
  const scores       = useGameStore(s => s.scores);
  const courseName   = useGameStore(s => s.courseName);
  const currentHole  = useGameStore(s => s.currentHole);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const holesPlayed = PLAYERS.some(p =>
    scores[p.id as PlayerId]?.some(s => s > 0)
  );
  const showContinue = gameActive && holesPlayed;

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 14px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: 'var(--gold)', letterSpacing: '0.5px' }}>
          New Round
        </h1>

        <div ref={menuRef} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
              background: menuOpen ? 'rgba(201,168,76,0.18)' : 'rgba(201,168,76,0.09)',
              border: '1px solid rgba(201,168,76,0.35)',
              color: 'var(--gold)', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            ☰
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
              background: '#122010', border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 10, overflow: 'hidden',
              boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
              minWidth: 140,
            }}>
              {MENU_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'block', padding: '11px 16px',
                    fontSize: 13, fontWeight: 600, color: 'var(--cream)',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(245,240,232,0.06)',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showContinue && (
        <button
          onClick={() => router.push('/game')}
          style={{
            width: '100%', marginBottom: 18,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 12, padding: '14px 16px',
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-bright)', marginBottom: 3 }}>
              ▶ Continue Round
            </div>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.5)' }}>
              {courseName || 'Round in progress'} · Hole {currentHole + 1}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--green-bright)', opacity: 0.7 }}>→</span>
        </button>
      )}

      <SetupStepper current={setupStep} onBack={setSetupStep} />

      {setupStep === 1 && (
        <Step1Course onNext={() => setSetupStep(2)} />
      )}
      {setupStep === 2 && (
        <Step2GameFormat onBack={() => setSetupStep(1)} onNext={() => setSetupStep(3)} />
      )}
      {setupStep === 3 && (
        <Step3Players onBack={() => setSetupStep(2)} />
      )}
    </div>
  );
}
