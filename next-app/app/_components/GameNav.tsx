'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useGameStore } from '../../store/gameStore';

const TABS = [
  { label: '🏌️ Score', path: '/game'  },
  { label: '📋 Card',  path: '/card'  },
  { label: '🏆 Teams', path: '/teams' },
  { label: '🎯 Comps', path: '/comps' },
];

export default function GameNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const gameActive = useGameStore(s => s.gameActive);

  return (
    <nav className="nav-tabs">
      {TABS.map(t => (
        <button
          key={t.path}
          className={`nav-tab${pathname === t.path ? ' active' : ''}`}
          onClick={() => router.push(t.path)}
          disabled={!gameActive && t.path !== '/history'}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
