'use client';

import { useGameStore } from '../../../store/gameStore';
import { PLAYERS } from '../../../store/gameStore';
import type { ActiveGames, PlayerId } from '../../../lib/types';

interface Props {
  onBack: () => void;
  onNext: () => void;
}

interface GameRow {
  emoji: string;
  title: string;
  desc: string;
  key: keyof ActiveGames | null;
  locked?: boolean;
}

const GAME_ROWS: GameRow[] = [
  { emoji: '🏌️', title: 'Individual Stableford', desc: 'All players score Stableford points per hole', key: null, locked: true },
  { emoji: '✖️', title: 'Team Multiplier', desc: 'Team totals × each other per hole', key: 'teamMultiplier' },
  { emoji: '🐺', title: 'Wolf', desc: 'Rotating wolf — blind, alone, or pick a partner each hole', key: 'wolf' },
  { emoji: '📊', title: 'Gross', desc: 'Total shots — traditional stroke play ranking', key: 'gross' },
  { emoji: '🏅', title: 'Net', desc: 'Gross minus playing handicap', key: 'net' },
  { emoji: '📍', title: 'Closest to Pin', desc: 'Closest to the pin on par 3s', key: 'ctp' },
  { emoji: '💨', title: 'Long Drive', desc: 'Longest drive on par 5s', key: 'longDrive' },
];

export default function Step2GameFormat({ onBack, onNext }: Props) {
  const activeGames  = useGameStore(s => s.activeGames);
  const wolfOrder    = useGameStore(s => s.wolfOrder);
  const setActiveGames = useGameStore(s => s.setActiveGames);
  const setWolfOrder   = useGameStore(s => s.setWolfOrder);

  function toggle(key: keyof ActiveGames) {
    setActiveGames({ [key]: !activeGames[key] });
  }

  function moveWolf(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= wolfOrder.length) return;
    const next = [...wolfOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setWolfOrder(next as PlayerId[]);
  }

  function shuffleWolf() {
    const next = [...wolfOrder];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setWolfOrder(next as PlayerId[]);
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">🎮 Game Format</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {GAME_ROWS.map(row => {
            const on = row.locked || (row.key ? activeGames[row.key] : false);
            return (
              <div
                key={row.title}
                onClick={() => !row.locked && row.key && toggle(row.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 11px', borderRadius: 9,
                  cursor: row.locked ? 'default' : 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s, border 0.15s',
                  background: on ? 'rgba(78,186,122,0.07)' : 'rgba(245,240,232,0.02)',
                  border: `1px solid ${on ? 'rgba(78,186,122,0.18)' : 'rgba(245,240,232,0.07)'}`,
                }}
              >
                <span style={{ fontSize: 15, opacity: on ? 1 : 0.35 }}>{row.emoji}</span>
                <div style={{ opacity: on ? 1 : 0.4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                  <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginTop: 1 }}>{row.desc}</div>
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                  color: on ? 'var(--green-bright)' : 'rgba(245,240,232,0.18)',
                }}>
                  {row.locked ? '●' : on ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>

        {activeGames.wolf && (
          <div style={{ marginTop: 14, paddingTop: 13, borderTop: '1px solid rgba(245,240,232,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)' }}>
                Wolf Rotation
              </div>
              <button
                onClick={shuffleWolf}
                style={{
                  padding: '4px 11px', fontSize: 10, fontWeight: 600, borderRadius: 12,
                  background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)',
                  color: 'rgba(245,240,232,0.55)', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.5px',
                }}
              >
                Shuffle
              </button>
            </div>
            {wolfOrder.map((pid, i) => {
              const p = PLAYERS.find(pl => pl.id === pid);
              if (!p) return null;
              return (
                <div key={pid} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0', borderBottom: '1px solid rgba(245,240,232,0.04)',
                }}>
                  <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['↑', '↓'] as const).map((arrow, di) => (
                      <button
                        key={arrow}
                        onClick={() => moveWolf(i, di === 0 ? -1 : 1)}
                        disabled={(di === 0 && i === 0) || (di === 1 && i === wolfOrder.length - 1)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'rgba(245,240,232,0.06)',
                          border: '1px solid rgba(245,240,232,0.1)',
                          color: 'var(--cream)', cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: (di === 0 && i === 0) || (di === 1 && i === wolfOrder.length - 1) ? 0.2 : 1,
                        }}
                      >
                        {arrow}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 8 }}>
              Holes 17 & 18: flip a tee to decide wolf
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onBack}>← Back</button>
        <button className="btn-primary" style={{ flex: 2 }} onClick={onNext}>Next — Players →</button>
      </div>
    </div>
  );
}
