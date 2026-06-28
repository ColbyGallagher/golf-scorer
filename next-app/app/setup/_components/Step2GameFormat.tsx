'use client';

import { useEffect, useState } from 'react';
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

interface GameSection {
  label: string;
  rows: GameRow[];
}

const GAME_SECTIONS: GameSection[] = [
  {
    label: 'Individual Scoring',
    rows: [
      { emoji: '🏌️', title: 'Individual Stableford', desc: 'All players score Stableford points per hole', key: null, locked: true },
      { emoji: '📊', title: 'Gross', desc: 'Total shots — traditional stroke play ranking', key: 'gross' },
      { emoji: '🏅', title: 'Net', desc: 'Gross minus playing handicap', key: 'net' },
    ],
  },
  {
    label: 'Games',
    rows: [
      { emoji: '✖️', title: 'Team Multiplier', desc: 'Team totals × each other per hole', key: 'teamMultiplier' },
      { emoji: '⛳', title: 'Best Ball', desc: 'Best stableford score per hole counts for the team', key: 'bestBall' },
      { emoji: '🐺', title: 'Wolf', desc: 'Rotating wolf — blind, alone, or pick a partner each hole', key: 'wolf' },
    ],
  },
  {
    label: 'Other',
    rows: [
      { emoji: '📍', title: 'Closest to Pin', desc: 'Closest to the pin on par 3s', key: 'ctp' },
      { emoji: '💨', title: 'Long Drive', desc: 'Longest drive on par 5s', key: 'longDrive' },
    ],
  },
];

interface GameInfoData {
  title: string;
  intro: string;
  table?: { label: string; val: string }[];
  extra?: string;
  example: string;
}

const GAME_INFO: Record<string, GameInfoData> = {
  'Individual Stableford': {
    title: 'Individual Stableford',
    intro: 'Points per hole based on net score vs par. Net score = gross shots minus handicap strokes on that hole (determined by stroke index). Always active.',
    table: [
      { label: 'Double eagle or better', val: '5 pts' },
      { label: 'Eagle', val: '4 pts' },
      { label: 'Birdie', val: '3 pts' },
      { label: 'Par', val: '2 pts' },
      { label: 'Bogey', val: '1 pt' },
      { label: 'Double bogey or worse', val: '0 pts' },
    ],
    example: 'Par 4, SI 6, your handicap is 18 → you get 1 stroke. You shoot 5 → net 4 = par → 2pts. You shoot 4 → net 3 = birdie → 3pts. You shoot 7 → net 6 = double bogey → 0pts.',
  },
  'Gross': {
    title: 'Gross',
    intro: 'Total shots across 18 holes with no handicap adjustment. Ranked from lowest to highest.',
    example: 'You shoot 78, Dave shoots 74. Dave wins gross.',
  },
  'Net': {
    title: 'Net',
    intro: 'Gross score minus your playing handicap (WHS formula: HI × Slope/113 + CR−Par, then 95% applied). Lower net score wins.',
    example: 'You shoot 80 gross. Playing handicap is 14. Net = 80 − 14 = 66. Dave shoots 78 gross with playing handicap 10, net 68. You win net.',
  },
  'Team Multiplier': {
    title: 'Team Multiplier',
    intro: 'Each hole, each player\'s stableford score is multiplied by their partner\'s stableford score to give the team\'s hole score. Team totals are summed across 18 holes. Higher total wins.',
    example: 'H5: Colby 3pts × Mitch 2pts = 6 for Team A. Dave 3pts × Scott 1pt = 3 for Team B. H5: A leads 6–3. After 18 holes Team A total 72, Team B 58 → Team A wins.',
  },
  'Best Ball': {
    title: 'Best Ball',
    intro: 'Each hole, the better stableford score of the two team players counts for the team. Team total = sum of best scores across 18 holes. Higher total wins.',
    extra: 'Without stroke indices, uses lowest gross score per hole instead (lower total wins).',
    example: 'H5: Colby 3pts, Mitch 1pt → Team A records 3pts. Dave 1pt, Scott 3pts → Team B records 3pts. Tied that hole. H6: Colby 2pts, Mitch 0pts → Team A records 2pts.',
  },
  'Wolf': {
    title: 'Wolf',
    intro: 'One player is the wolf each hole, rotating in order. The wolf declares their mode before anyone tees off:',
    table: [
      { label: 'Partner', val: 'Pick 1 player. Best of wolf+partner vs best of other two. Win: 2pts each. Lose: 3pts to each opponent.' },
      { label: 'Alone', val: 'Wolf vs the other 3. Win: 4pts from each opponent. Lose: 2pts to each opponent.' },
      { label: 'Blind Wolf', val: 'Alone, declared before anyone tees. Win: 8pts from each. Lose: 2pts to each opponent.' },
    ],
    extra: 'Holes 17 & 18: flip a tee to decide who is wolf.',
    example: 'H1, Colby is wolf. He goes Alone. Colby birdies (3pts), everyone else pars (2pts). Colby wins → gets 4pts from each player.',
  },
  'Closest to Pin': {
    title: 'Closest to Pin',
    intro: 'On par 3 holes, whoever\'s ball finishes closest to the pin wins that hole\'s CTP. Recorded during play on the score screen. Tallied at end of round.',
    example: 'H4 is a par 3. Mitch lands 2m from the pin, Scott 4m, others further. Mitch wins H4 CTP.',
  },
  'Long Drive': {
    title: 'Long Drive',
    intro: 'On par 5 holes, the longest drive wins that hole\'s LD. Recorded during play on the score screen. Tallied at end of round.',
    example: 'H5 is a par 5. Scott drives 280m in the fairway, Dave 260m. Scott wins H5 long drive.',
  },
};

function InfoModal({ infoKey, onClose }: { infoKey: string; onClose: () => void }) {
  const info = GAME_INFO[infoKey];
  if (!info) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 12px 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2412', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 16, padding: '20px 18px', width: '100%', maxWidth: 480,
          boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--gold)' }}>
            {info.title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'rgba(245,240,232,0.4)',
              fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
            }}
          >✕</button>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', lineHeight: 1.6, margin: '0 0 10px' }}>
          {info.intro}
        </p>

        {info.table && (
          <div style={{ marginBottom: 10 }}>
            {info.table.map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '5px 0', borderBottom: '1px solid rgba(245,240,232,0.05)',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'rgba(245,240,232,0.5)' }}>{row.label}</span>
                <span style={{ color: 'var(--cream)', fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: 'right', maxWidth: '55%' }}>{row.val}</span>
              </div>
            ))}
          </div>
        )}

        {info.extra && (
          <p style={{ fontSize: 11, color: 'rgba(201,168,76,0.7)', lineHeight: 1.5, margin: '0 0 10px' }}>
            {info.extra}
          </p>
        )}

        <div style={{
          background: 'rgba(245,240,232,0.04)', borderRadius: 8,
          padding: '10px 12px', fontSize: 11, color: 'rgba(245,240,232,0.55)', lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 6 }}>Example:</span>
          {info.example}
        </div>
      </div>
    </div>
  );
}

export default function Step2GameFormat({ onBack, onNext }: Props) {
  const activeGames    = useGameStore(s => s.activeGames);
  const wolfOrder      = useGameStore(s => s.wolfOrder);
  const indices        = useGameStore(s => s.indices);
  const isTourRound    = useGameStore(s => s.isTourRound);
  const setActiveGames  = useGameStore(s => s.setActiveGames);
  const setWolfOrder    = useGameStore(s => s.setWolfOrder);
  const setIsTourRound  = useGameStore(s => s.setIsTourRound);

  const [infoKey, setInfoKey] = useState<string | null>(null);

  const missingIndices = indices.length === 18 && indices.every(i => i === 0);

  // When no SI, default to gross enabled
  useEffect(() => {
    if (missingIndices && !activeGames.gross) {
      setActiveGames({ gross: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingIndices]);

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
      <div
        onClick={() => setIsTourRound(!isTourRound)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
          userSelect: 'none', marginBottom: 10,
          background: isTourRound ? 'rgba(201,168,76,0.08)' : 'rgba(245,240,232,0.02)',
          border: `1px solid ${isTourRound ? 'rgba(201,168,76,0.35)' : 'rgba(245,240,232,0.07)'}`,
          transition: 'background 0.15s, border 0.15s',
        }}
      >
        <span style={{ fontSize: 18, opacity: isTourRound ? 1 : 0.35 }}>🏅</span>
        <div style={{ opacity: isTourRound ? 1 : 0.45, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isTourRound ? 'var(--gold)' : 'var(--cream)' }}>DE World Tour</div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginTop: 1 }}>Mark as a season tour event</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: isTourRound ? 'var(--gold)' : 'rgba(245,240,232,0.18)' }}>
          {isTourRound ? 'ON' : 'OFF'}
        </span>
      </div>

      <div className="card">
        <div className="card-title">🎮 Game Format</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GAME_SECTIONS.map((section, si) => (
            <div key={section.label}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.3)', marginBottom: 6,
                paddingBottom: 5,
                borderBottom: '1px solid rgba(245,240,232,0.06)',
              }}>
                {section.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {section.rows.map(row => {
                  const isStableford = row.key === null;
                  const noSI = isStableford && missingIndices;
                  const isBestBallNoSI = row.key === 'bestBall' && missingIndices;
                  const on = !noSI && (row.locked || (row.key ? activeGames[row.key] : false));
                  const desc = isBestBallNoSI
                    ? 'No stroke indices — scoring based on gross shots only'
                    : noSI
                      ? 'No stroke indices — enter SI on course tab to enable'
                      : row.desc;
                  return (
                    <div key={row.title}>
                      <div
                        onClick={() => !noSI && !row.locked && row.key && toggle(row.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 11px', borderRadius: isBestBallNoSI && on ? '9px 9px 0 0' : 9,
                          cursor: noSI ? 'not-allowed' : row.locked ? 'default' : 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.15s, border 0.15s',
                          background: noSI ? 'rgba(245,240,232,0.01)' : on ? 'rgba(34,197,94,0.07)' : 'rgba(245,240,232,0.02)',
                          border: `1px solid ${noSI ? 'rgba(245,240,232,0.04)' : on ? 'rgba(34,197,94,0.18)' : 'rgba(245,240,232,0.07)'}`,
                          borderBottom: isBestBallNoSI && on ? 'none' : undefined,
                          opacity: noSI ? 0.38 : 1,
                        }}
                      >
                        <span style={{ fontSize: 15, opacity: on ? 1 : 0.35 }}>{row.emoji}</span>
                        <div style={{ opacity: on ? 1 : 0.4, flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginTop: 1 }}>{desc}</div>
                        </div>
                        {GAME_INFO[row.title] && (
                          <button
                            onClick={e => { e.stopPropagation(); setInfoKey(row.title); }}
                            style={{
                              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(245,240,232,0.08)', border: '1px solid rgba(245,240,232,0.15)',
                              color: 'rgba(245,240,232,0.4)', fontSize: 10, fontWeight: 700,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              lineHeight: 1, fontFamily: 'serif',
                            }}
                          >i</button>
                        )}
                        <span style={{
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                          color: noSI ? 'rgba(245,240,232,0.18)' : on ? 'var(--green-bright)' : 'rgba(245,240,232,0.18)',
                        }}>
                          {noSI ? '—' : row.locked ? '●' : on ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      {isBestBallNoSI && on && (
                        <div style={{
                          padding: '7px 11px', fontSize: 10,
                          background: 'rgba(201,168,76,0.08)',
                          border: '1px solid rgba(34,197,94,0.18)',
                          borderTop: '1px solid rgba(201,168,76,0.2)',
                          borderRadius: '0 0 9px 9px',
                          color: 'rgba(201,168,76,0.8)',
                        }}>
                          ⚠️ No stroke indices — best ball uses lowest gross score per hole. Add SI on the Course tab for stableford-based best ball.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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

      {infoKey && <InfoModal infoKey={infoKey} onClose={() => setInfoKey(null)} />}
    </div>
  );
}
