'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';
import { stablefordPoints, strokesOnHole, ptsClass, ptsLabel, getEffectivePlayingHandicaps, teamMultiplierHole } from '../../../lib/scoring';
import type { PlayerId, Team } from '../../../lib/types';

interface Props {
  hole: number;
}

const TEAMS: Team[] = ['A', 'B'];

const TEAM_COLORS: Record<Team, string> = {
  A: 'rgba(34,197,94,0.15)',
  B: 'rgba(59,130,246,0.15)',
};

const TEAM_BORDER: Record<Team, string> = {
  A: 'rgba(34,197,94,0.3)',
  B: 'rgba(59,130,246,0.3)',
};

const TEAM_TEXT: Record<Team, string> = {
  A: '#4ade80',
  B: '#60a5fa',
};

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
  const activeGames            = useGameStore(s => s.activeGames);
  const setScore               = useGameStore(s => s.setScore);
  const setThreePutt           = useGameStore(s => s.setThreePutt);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const par = pars[hole];
  const hasDupeIndices = new Set(indices).size !== indices.length;

  // Pre-compute multiplier result once if needed
  const multiplierResult = activeGames.teamMultiplier
    ? teamMultiplierHole(hole, PLAYERS, scores, pars, playingHandicaps, indices, teamAssignments)
    : null;

  function holeTeamScore(team: Team): { score: number; label: string } | null {
    const teamPs = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === team);
    if (!teamPs.some(p => scores[p.id as PlayerId][hole] > 0)) return null;

    if (activeGames.teamMultiplier && multiplierResult) {
      const score = team === 'A' ? multiplierResult.scoreA : multiplierResult.scoreB;
      const pts   = team === 'A' ? multiplierResult.ptsA   : multiplierResult.ptsB;
      return { score, label: `${pts.join(' × ')} = ${score}` };
    }
    if (activeGames.bestBall) {
      const score = Math.max(...teamPs.map(p =>
        stablefordPoints(scores[p.id as PlayerId][hole], par, p.id as PlayerId, hole, playingHandicaps, indices) ?? 0,
      ));
      return { score, label: `${score} pts` };
    }
    const score = teamPs.reduce((sum, p) =>
      sum + (stablefordPoints(scores[p.id as PlayerId][hole], par, p.id as PlayerId, hole, playingHandicaps, indices) ?? 0), 0);
    return { score, label: `${score} pts` };
  }

  const showTeamScore = activeGames.teamMultiplier || activeGames.bestBall || activeGames.nassau;

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
        {TEAMS.map((team, ti) => {
          const teamPs    = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === team);
          const teamScore = showTeamScore ? holeTeamScore(team) : null;

          return (
            <div key={team}>
              {ti > 0 && (
                <div style={{
                  height: 1,
                  background: 'rgba(245,240,232,0.08)',
                  margin: '6px 0',
                }} />
              )}

              {/* Team header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', marginBottom: 3,
                background: TEAM_COLORS[team],
                borderLeft: `3px solid ${TEAM_BORDER[team]}`,
                borderRadius: '0 6px 6px 0',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEAM_TEXT[team], textTransform: 'uppercase' }}>
                  Team {team}
                </span>
                {teamScore && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: TEAM_TEXT[team] }}>
                    {activeGames.teamMultiplier ? teamScore.label : teamScore.label}
                  </span>
                )}
              </div>

              {teamPs.map(p => {
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
                        HCP {playingHandicaps[pid]} · {sr} stroke{sr !== 1 ? 's' : ''}
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
          );
        })}
      </div>
    </div>
  );
}
