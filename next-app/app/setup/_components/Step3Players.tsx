'use client';

import { useRouter } from 'next/navigation';
import { useGameStore, PLAYERS } from '../../../store/gameStore';
import { getPlayingHandicap } from '../../../lib/scoring';
import type { PlayerId, Team } from '../../../lib/types';

interface Props {
  onBack: () => void;
}

export default function Step3Players({ onBack }: Props) {
  const router   = useRouter();
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);
  const pars                   = useGameStore(s => s.pars);
  const teamAssignments        = useGameStore(s => s.teamAssignments);
  const activeGames            = useGameStore(s => s.activeGames);
  const setHandicap            = useGameStore(s => s.setHandicap);
  const setDailyHandicapOverride = useGameStore(s => s.setDailyHandicapOverride);
  const setCourseRating        = useGameStore(s => s.setCourseRating);
  const setSlopeRating         = useGameStore(s => s.setSlopeRating);
  const setTeamAssignment      = useGameStore(s => s.setTeamAssignment);
  const setGameActive          = useGameStore(s => s.setGameActive);

  const showTeams = activeGames.teamMultiplier || activeGames.nassau;

  function startGame() {
    setGameActive(true);
    router.push('/game');
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">👥 Players & Handicaps</div>

        {PLAYERS.map(p => (
          <div key={p.id} className="player-row">
            <div className="player-dot" style={{ background: p.color }} />
            <span className="player-name-label">{p.name}</span>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>HI</span>
            <input
              className="hcp-input"
              type="number"
              step="0.1"
              min={0}
              max={54}
              inputMode="decimal"
              value={handicaps[p.id as PlayerId]}
              onChange={e => setHandicap(p.id as PlayerId, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,240,232,0.08)' }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)', marginBottom: 8 }}>
            Daily Handicap — WHS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginBottom: 4 }}>Course Rating</div>
              <input
                className="hcp-input"
                style={{ width: '100%' }}
                type="number"
                step="0.1"
                min={60}
                max={80}
                inputMode="decimal"
                value={courseRating}
                onChange={e => setCourseRating(parseFloat(e.target.value) || 71)}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginBottom: 4 }}>Slope Rating</div>
              <input
                className="hcp-input"
                style={{ width: '100%' }}
                type="number"
                step="1"
                min={55}
                max={155}
                inputMode="numeric"
                value={slopeRating}
                onChange={e => setSlopeRating(parseInt(e.target.value) || 113)}
              />
            </div>
          </div>

          {PLAYERS.map(p => {
            const pid        = p.id as PlayerId;
            const computed   = getPlayingHandicap(pid, handicaps, courseRating, slopeRating, pars);
            const isOverride = dailyHandicapOverrides[pid] !== undefined;
            const displayVal = isOverride ? dailyHandicapOverrides[pid]! : computed;

            return (
              <div key={pid} style={{ marginBottom: 6 }}>
                <div
                  className="player-row"
                  style={{
                    padding: '6px 11px',
                    ...(isOverride ? {
                      background: 'rgba(201,168,76,0.07)',
                      border: '1px solid rgba(201,168,76,0.28)',
                      borderRadius: 8,
                    } : {}),
                  }}
                >
                  <div className="player-dot" style={{ background: p.color }} />
                  <span className="player-name-label">{p.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>Daily HCP</span>
                  <input
                    className="hcp-input"
                    type="number"
                    step="1"
                    min={-10}
                    max={54}
                    inputMode="numeric"
                    value={displayVal}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (isNaN(v)) return;
                      setDailyHandicapOverride(pid, v === computed ? null : v);
                    }}
                    style={isOverride ? { color: 'var(--gold)', borderColor: 'rgba(201,168,76,0.45)' } : { color: 'var(--green-bright)' }}
                  />
                  {isOverride && (
                    <button
                      onClick={() => setDailyHandicapOverride(pid, null)}
                      title={`Reset to auto (${computed})`}
                      style={{
                        marginLeft: 4, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)',
                        color: 'var(--gold)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >↺</button>
                  )}
                </div>
                {isOverride && (
                  <div style={{ fontSize: 10, color: 'var(--gold)', padding: '3px 11px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                    ✏️ Manually adjusted · auto would be {computed}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showTeams && (
        <div className="card">
          <div className="card-title">🤝 Teams</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
            {(['A', 'B'] as Team[]).map(team => {
              const teamPlayers = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === team);
              const color = team === 'A' ? 'var(--team-a)' : 'var(--team-b)';
              const bg    = team === 'A' ? 'rgba(78,186,122,0.08)' : 'rgba(85,153,204,0.08)';
              const border= team === 'A' ? 'rgba(78,186,122,0.2)' : 'rgba(85,153,204,0.2)';
              return (
                <div key={team} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 11 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color, marginBottom: 5 }}>Team {team}</div>
                  {teamPlayers.length
                    ? teamPlayers.map(p => <div key={p.id} style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>)
                    : <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>— empty —</div>
                  }
                </div>
              );
            })}
          </div>

          {PLAYERS.map(p => {
            const inA = teamAssignments[p.id as PlayerId] === 'A';
            return (
              <div key={p.id} className="player-row" style={{ padding: '6px 11px' }}>
                <div className="player-dot" style={{ background: p.color }} />
                <span className="player-name-label">{p.name}</span>
                <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
                  {(['A', 'B'] as Team[]).map(team => {
                    const active = team === 'A' ? inA : !inA;
                    const color  = team === 'A' ? 'var(--team-a)' : 'var(--team-b)';
                    return (
                      <button
                        key={team}
                        onClick={() => setTeamAssignment(p.id as PlayerId, team)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', border: '1px solid',
                          transition: 'all 0.15s',
                          background: active ? `rgba(${team === 'A' ? '78,186,122' : '85,153,204'},0.25)` : 'transparent',
                          borderColor: active ? color : 'rgba(245,240,232,0.15)',
                          color: active ? color : 'rgba(245,240,232,0.3)',
                        }}
                      >
                        {team}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>
            Multiplier game: best Stableford per team × each other each hole.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onBack}>← Back</button>
        <button className="btn-primary" style={{ flex: 2 }} onClick={startGame}>Start Scoring →</button>
      </div>
    </div>
  );
}
