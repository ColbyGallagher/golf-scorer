'use client';

import { useGameStore, PLAYERS } from '../../store/gameStore';
import { calcWolf, calcSkins, stablefordPoints, getEffectivePlayingHandicaps } from '../../lib/scoring';
import type { PlayerId } from '../../lib/types';
import GameNav from '../_components/GameNav';

export default function CompsPage() {
  const scores                 = useGameStore(s => s.scores);
  const pars                   = useGameStore(s => s.pars);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);
  const indices                = useGameStore(s => s.indices);
  const activeGames            = useGameStore(s => s.activeGames);
  const compWinners            = useGameStore(s => s.compWinners);
  const threePutts             = useGameStore(s => s.threePutts);
  const wolfOrder              = useGameStore(s => s.wolfOrder);
  const wolfHoles              = useGameStore(s => s.wolfHoles);
  const wolfOverrides          = useGameStore(s => s.wolfOverrides);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const par3s = pars.map((p, i) => p === 3 ? i : -1).filter(h => h >= 0);
  const par5s = pars.map((p, i) => p === 5 ? i : -1).filter(h => h >= 0);

  function winnerEl(pid: string) {
    if (!pid) return <span style={{ color: 'rgba(245,240,232,0.2)' }}>— TBD —</span>;
    if (pid === 'none') return <span style={{ color: 'rgba(245,240,232,0.3)' }}>No Result</span>;
    const pl = PLAYERS.find(x => x.id === pid);
    return <span style={{ color: pl?.color, fontWeight: 600 }}>{pl?.name}</span>;
  }

  const anyPutts = PLAYERS.some(p => threePutts[p.id as PlayerId]?.some(Boolean));

  return (
    <>
      <GameNav />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
        {/* CTP card */}
        <div className="card">
          <div className="card-title">📍 Closest to the Pin · Par 3s</div>
          {!activeGames.ctp ? (
            <div className="empty-state">Disabled — turn on Closest to Pin in Setup → Game Format</div>
          ) : par3s.length === 0 ? (
            <div className="empty-state">No par 3s</div>
          ) : (
            par3s.map(h => (
              <div key={h} className="comp-row">
                <span className="comp-hole">H{h + 1}</span>
                <span className="comp-type">📍 CTP</span>
                <span className="comp-winner">{winnerEl(compWinners[h]?.ctp ?? '')}</span>
              </div>
            ))
          )}
        </div>

        {/* Long Drive card */}
        <div className="card">
          <div className="card-title">💨 Long Drive · Par 5s</div>
          {!activeGames.longDrive ? (
            <div className="empty-state">Disabled — turn on Long Drive in Setup → Game Format</div>
          ) : par5s.length === 0 ? (
            <div className="empty-state">No par 5s</div>
          ) : (
            par5s.map(h => (
              <div key={h} className="comp-row">
                <span className="comp-hole">H{h + 1}</span>
                <span className="comp-type">💨 Long Drive</span>
                <span className="comp-winner">{winnerEl(compWinners[h]?.ld ?? '')}</span>
              </div>
            ))
          )}
        </div>

        {/* Wolf results */}
        {activeGames.wolf && (
          <WolfResults scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices} wolfOrder={wolfOrder} wolfHoles={wolfHoles} wolfOverrides={wolfOverrides} />
        )}

        {/* Skins results (read-only summary) */}
        {activeGames.skins && (
          <SkinsResults scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices} />
        )}

        {/* 3-putt summary */}
        {anyPutts && (
          <div className="card">
            <div className="card-title">⛳ 3-Putt Summary</div>
            {PLAYERS.map((p, i) => {
              const tp     = threePutts[p.id as PlayerId] || Array(18).fill(false);
              const total  = tp.filter(Boolean).length;
              const frontCt = tp.slice(0, 9).filter(Boolean).length;
              const backCt  = tp.slice(9).filter(Boolean).length;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', ...(i < PLAYERS.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.05)' } : {}) }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>F:{frontCt} · B:{backCt}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'right', color: total > 0 ? '#e07070' : 'rgba(245,240,232,0.25)' }}>{total}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function WolfResults({ scores, pars, handicaps, indices, wolfOrder, wolfHoles, wolfOverrides }: {
  scores: Record<PlayerId, number[]>; pars: number[];
  handicaps: Record<PlayerId, number>; indices: number[];
  wolfOrder: PlayerId[]; wolfHoles: { mode: string | null; partnerId: string | null }[];
  wolfOverrides: Record<number, string>;
}) {
  const results = calcWolf(PLAYERS, scores, pars, handicaps, indices, wolfOrder, wolfHoles as Parameters<typeof calcWolf>[6], wolfOverrides);
  const totals  = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  results.forEach(r => PLAYERS.forEach(p => { totals[p.id] += r.pm[p.id] || 0; }));
  const sorted  = [...PLAYERS].sort((a, b) => totals[b.id] - totals[a.id]);

  const holeRows = results.filter(r => r.mode);

  return (
    <div className="card">
      <div className="card-title">🐺 Wolf</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', ...(i < sorted.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.06)' } : {}) }}>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 14 }}>{i + 1}</span>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: totals[p.id] > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.25)' }}>{totals[p.id]} pts</span>
          </div>
        ))}
      </div>

      {holeRows.length === 0 ? (
        <div className="empty-state">No wolf decisions recorded yet</div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: 7 }}>Hole by Hole</div>
          {holeRows.map(r => {
            const wolf    = PLAYERS.find(p => p.id === r.wolfId);
            const partner = r.partnerId ? PLAYERS.find(p => p.id === r.partnerId) : null;
            const modeTag = r.mode === 'blind' ? '🎯 Blind' : r.mode === 'alone' ? '🚶 Alone' : `🤝 ${partner?.name || '?'}`;
            const pts     = PLAYERS.map(p => r.pm[p.id] > 0 ? `${p.name} +${r.pm[p.id]}` : '').filter(Boolean);
            return (
              <div key={r.hole} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gold)', minWidth: 28 }}>H{r.hole + 1}</span>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: wolf?.color, flexShrink: 0 }} />
                <span style={{ minWidth: 42, color: 'rgba(245,240,232,0.6)' }}>{wolf?.name}</span>
                <span style={{ color: 'rgba(245,240,232,0.3)', minWidth: 60 }}>{modeTag}</span>
                <span style={{ flex: 1, color: pts.length ? 'var(--green-bright)' : 'var(--gold)' }}>{pts.join(', ') || 'Draw'}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SkinsResults({ scores, pars, handicaps, indices }: {
  scores: Record<PlayerId, number[]>; pars: number[];
  handicaps: Record<PlayerId, number>; indices: number[];
}) {
  const skins  = calcSkins(PLAYERS, scores, pars, handicaps, indices);
  const totals = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  skins.filter(s => s.winner).forEach(s => { if (s.winner) totals[s.winner.id] += s.value; });
  const board  = [...PLAYERS].sort((a, b) => totals[b.id] - totals[a.id]);

  return (
    <div className="card">
      <div className="card-title">🃏 Skins</div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
        {board.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{p.name}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: totals[p.id] > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.2)' }}>{totals[p.id]}</span>
          </div>
        ))}
      </div>
      {skins.filter(s => !s.unplayed).length === 0 ? (
        <div className="empty-state">No holes scored yet</div>
      ) : (
        skins.filter(s => !s.unplayed).map(s => (
          <div key={s.hole} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gold)', minWidth: 28 }}>H{s.hole + 1}</span>
            {s.winner ? (
              <span style={{ color: s.winner.color, fontWeight: 600 }}>
                {s.winner.name}{s.value > 1 && <span style={{ color: 'var(--gold)', fontSize: 10 }}> ({s.value} skins)</span>}
              </span>
            ) : s.tied ? (
              <span style={{ color: 'rgba(245,240,232,0.35)' }}>Tied — carries →</span>
            ) : (
              <span style={{ color: 'rgba(245,240,232,0.18)' }}>No score</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
