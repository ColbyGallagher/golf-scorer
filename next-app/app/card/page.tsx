'use client';

import { useGameStore, PLAYERS } from '../../store/gameStore';
import { stablefordPoints, totalStableford, grossScore, getEffectivePlayingHandicaps } from '../../lib/scoring';
import type { PlayerId } from '../../lib/types';
import GameNav from '../_components/GameNav';

export default function CardPage() {
  const scores                 = useGameStore(s => s.scores);
  const pars                   = useGameStore(s => s.pars);
  const indices                = useGameStore(s => s.indices);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const activeGames            = useGameStore(s => s.activeGames);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const front = Array.from({ length: 9 }, (_, i) => i);
  const back  = Array.from({ length: 9 }, (_, i) => i + 9);

  const cnt = Array.from({ length: 18 }, (_, h) =>
    PLAYERS.some(p => scores[p.id as PlayerId][h] > 0),
  ).filter(Boolean).length;

  function cell(pid: PlayerId, h: number) {
    const s = scores[pid][h];
    if (!s) return { val: '—', color: 'rgba(245,240,232,0.15)' };
    const pts = stablefordPoints(s, pars[h], pid, h, playingHandicaps, indices);
    const color = pts !== null && pts >= 4 ? 'var(--gold)'
      : pts !== null && pts >= 3 ? 'var(--green-bright)' : '';
    return { val: String(s), color };
  }

  function sectionPts(pid: PlayerId, holes: number[]) {
    return holes.reduce((sum, h) =>
      sum + (stablefordPoints(scores[pid][h], pars[h], pid, h, playingHandicaps, indices) ?? 0), 0);
  }

  const sfRows = [...PLAYERS]
    .map(p => ({ p, pts: totalStableford(p.id as PlayerId, scores, pars, playingHandicaps, indices) }))
    .sort((a, b) => b.pts - a.pts);

  const gnRows = [...PLAYERS].map(p => {
    const pid   = p.id as PlayerId;
    const gross = grossScore(pid, scores);
    const ph    = playingHandicaps[pid];
    const net   = gross > 0 ? gross - ph : 0;
    const thru  = scores[pid].filter(v => v > 0).length;
    return { p, gross, net, ph, thru };
  });

  return (
    <>
      <GameNav />
      <div className="card-page-wrap">
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${cnt / 18 * 100}%` }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 4, marginBottom: 10 }}>
          {cnt} / 18 holes played
        </div>

        <div className="scorecard-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th className="sc-name">Player</th>
                {front.map(h => <th key={h}>{h + 1}</th>)}
                <th>OUT</th>
                {back.map(h => <th key={h}>{h + 1}</th>)}
                <th>IN</th>
                <th>TOT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="sc-par-row">
                <td className="sc-name" style={{ color: 'rgba(245,240,232,0.35)' }}>Par</td>
                {front.map(h => <td key={h}>{pars[h]}</td>)}
                <td>{front.reduce((s, h) => s + pars[h], 0)}</td>
                {back.map(h => <td key={h}>{pars[h]}</td>)}
                <td>{back.reduce((s, h) => s + pars[h], 0)}</td>
                <td>{pars.reduce((a, b) => a + b, 0)}</td>
              </tr>
              <tr className="sc-idx-row">
                <td className="sc-name" style={{ color: 'rgba(245,240,232,0.25)' }}>SI</td>
                {front.map(h => <td key={h}>{indices[h]}</td>)}
                <td>–</td>
                {back.map(h => <td key={h}>{indices[h]}</td>)}
                <td>–</td>
                <td>–</td>
              </tr>
              {PLAYERS.map(p => {
                const pid = p.id as PlayerId;
                return (
                  <tr key={pid}>
                    <td className="sc-name">
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: p.color, marginRight: 4, verticalAlign: 'middle' }} />
                      {p.name}
                    </td>
                    {front.map(h => {
                      const c = cell(pid, h);
                      return <td key={h} style={{ color: c.color }}>{c.val}</td>;
                    })}
                    <td className="sc-total">{sectionPts(pid, front)}</td>
                    {back.map(h => {
                      const c = cell(pid, h);
                      return <td key={h} style={{ color: c.color }}>{c.val}</td>;
                    })}
                    <td className="sc-total">{sectionPts(pid, back)}</td>
                    <td className="sc-total" style={{ fontSize: 11 }}>
                      {totalStableford(pid, scores, pars, handicaps, indices)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">🏆 Stableford</div>
          {sfRows.map((r, i) => (
            <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', ...(i < sfRows.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.05)' } : {}) }}>
              <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 14, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.p.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.p.name}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{r.pts} pts</span>
            </div>
          ))}
        </div>

        {activeGames.gross && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">📊 Gross</div>
            {[...gnRows].sort((a, b) => (b.thru - a.thru) || ((a.gross || 999) - (b.gross || 999))).map((r, i) => (
              <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', ...(i < gnRows.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.05)' } : {}) }}>
                <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 14, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.p.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.p.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: r.gross > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.2)' }}>
                  {r.gross || '—'}
                  {r.thru > 0 && r.thru < 18 && <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', marginLeft: 4 }}>thru {r.thru}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeGames.net && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">🏅 Net</div>
            {[...gnRows].sort((a, b) => (b.thru - a.thru) || ((a.net || 999) - (b.net || 999))).map((r, i) => (
              <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', ...(i < gnRows.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.05)' } : {}) }}>
                <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 14, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.p.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.p.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: r.gross > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.2)' }}>
                  {r.gross ? r.net : '—'}
                  {r.thru > 0 && r.thru < 18 && <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', marginLeft: 4 }}>thru {r.thru}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
