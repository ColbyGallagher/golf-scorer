'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';
import { stablefordPoints, strokesOnHole, ptsClass, ptsLabel, getEffectivePlayingHandicaps } from '../../../lib/scoring';
import type { PlayerId } from '../../../lib/types';

interface Props {
  hole: number;
}

export default function ScoreGrid({ hole }: Props) {
  const scores                 = useGameStore(s => s.scores);
  const threePutts             = useGameStore(s => s.threePutts);
  const pars                   = useGameStore(s => s.pars);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);
  const indices                = useGameStore(s => s.indices);
  const teamAssignments        = useGameStore(s => s.teamAssignments);
  const setScore               = useGameStore(s => s.setScore);
  const setThreePutt           = useGameStore(s => s.setThreePutt);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const par = pars[hole];
  const hasDupeIndices = new Set(indices).size !== indices.length;

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 9 }}>🏌️ Scores</div>

      {hasDupeIndices && (
        <div style={{
          marginBottom: 10, padding: '8px 11px',
          background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 8, fontSize: 12, color: 'var(--red)',
        }}>
          ⚠️ Fix duplicate stroke indices above before entering scores
        </div>
      )}

      <div className="score-grid" style={hasDupeIndices ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
        {PLAYERS.map(p => {
          const pid     = p.id as PlayerId;
          const strokes = scores[pid][hole];
          const sr      = strokesOnHole(pid, hole, playingHandicaps, indices);
          const pts     = stablefordPoints(strokes, par, pid, hole, playingHandicaps, indices);
          const tp      = threePutts[pid][hole];

          return (
            <div key={pid} className="score-row">
              <div className="score-player-dot" style={{ background: p.color }} />
              <div className="score-player-info">
                <div className="score-player-name">
                  {p.name}
                  {Array.from({ length: sr }, (_, i) => (
                    <span key={i} className="stroke-dot" />
                  ))}
                </div>
                <div className="score-player-sub">
                  HCP {playingHandicaps[pid]} · {sr} stroke{sr !== 1 ? 's' : ''} · Team {teamAssignments[pid]}
                </div>
              </div>

              <div className="score-controls">
                <button
                  className="score-btn"
                  onClick={() => setScore(pid, hole, Math.max(0, strokes - 1))}
                >
                  −
                </button>
                <span className="score-display">{strokes > 0 ? strokes : '—'}</span>
                <button
                  className="score-btn"
                  onClick={() => setScore(pid, hole, strokes + 1)}
                >
                  +
                </button>
              </div>

              <span className={`score-points ${ptsClass(pts)}`}>{ptsLabel(pts)}</span>

              <button
                className={`three-putt-btn${tp ? ' three-putt-on' : ''}`}
                onClick={() => setThreePutt(pid, hole, !tp)}
              >
                3P
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
