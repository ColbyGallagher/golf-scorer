'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useGameStore } from '../../store/gameStore';
import SetupStepper from './_components/SetupStepper';
import Step1Course from './_components/Step1Course';
import Step2GameFormat from './_components/Step2GameFormat';
import Step3Players from './_components/Step3Players';

const MENU_ITEMS = [
  { href: '/players',  label: '👤 Players'  },
  { href: '/history',  label: '📚 History'  },
  { href: '/courses',  label: '⛳ Courses'  },
];

export default function SetupPage() {
  const setupStep    = useGameStore(s => s.setupStep);
  const setSetupStep = useGameStore(s => s.setSetupStep);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
