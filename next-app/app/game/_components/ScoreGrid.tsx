'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';
import { stablefordPoints, strokesOnHole, ptsClass, ptsLabel } from '../../../lib/scoring';
import type { PlayerId } from '../../../lib/types';

interface Props {
  hole: number;
}

export default function ScoreGrid({ hole }: Props) {
  const scores      = useGameStore(s => s.scores);
  const threePutts  = useGameStore(s => s.threePutts);
  const pars        = useGameStore(s => s.pars);
  const handicaps   = useGameStore(s => s.handicaps);
  const indices     = useGameStore(s => s.indices);
  const teamAssignments = useGameStore(s => s.teamAssignments);
  const setScore      = useGameStore(s => s.setScore);
  const setThreePutt  = useGameStore(s => s.setThreePutt);

  const par = pars[hole];

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 9 }}>🏌️ Scores</div>
      <div className="score-grid">
        {PLAYERS.map(p => {
          const pid     = p.id as PlayerId;
          const strokes = scores[pid][hole];
          const sr      = strokesOnHole(pid, hole, handicaps, indices);
          const pts     = stablefordPoints(strokes, par, pid, hole, handicaps, indices);
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
                  HCP {handicaps[pid]} · {sr} stroke{sr !== 1 ? 's' : ''} · Team {teamAssignments[pid]}
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
