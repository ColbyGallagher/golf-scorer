'use client';

import { useGameStore, PLAYERS } from '../../store/gameStore';
import { totalStableford, teamTotals, teamMultiplierHole, calcSkins, calcNassau, grossScore, getEffectivePlayingHandicaps } from '../../lib/scoring';
import type { PlayerId, Team } from '../../lib/types';
import GameNav from '../_components/GameNav';

export default function TeamsPage() {
  const scores                 = useGameStore(s => s.scores);
  const pars                   = useGameStore(s => s.pars);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const indices                = useGameStore(s => s.indices);
  const activeGames            = useGameStore(s => s.activeGames);
  const teamAssignments        = useGameStore(s => s.teamAssignments);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const hasTeamFormat = activeGames.teamMultiplier || activeGames.nassau;
  const teamAPlayers  = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === 'A');
  const teamBPlayers  = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === 'B');
  const teamAName     = teamAPlayers.map(p => p.name).join(' & ') || 'Team A';
  const teamBName     = teamBPlayers.map(p => p.name).join(' & ') || 'Team B';

  return (
    <>
      <GameNav />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
        {!hasTeamFormat && !activeGames.skins && !activeGames.gross && !activeGames.net ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>No team formats active for this round.</div>
        ) : (
          <>
            {hasTeamFormat && <TeamBlock
              teamAName={teamAName} teamBName={teamBName}
              teamAPlayers={teamAPlayers} teamBPlayers={teamBPlayers}
              scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices}
              teamAssignments={teamAssignments as Record<PlayerId, Team>}
              activeGames={activeGames}
            />}
            {activeGames.skins && <SkinsSection scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices} />}
            {activeGames.nassau && hasTeamFormat && <NassauSection
              teamAName={teamAName} teamBName={teamBName}
              scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices}
              teamAssignments={teamAssignments as Record<PlayerId, Team>}
            />}
            {(activeGames.gross || activeGames.net) && <GrossNetSection
              scores={scores} pars={pars} handicaps={playingHandicaps} indices={indices}
              showGross={activeGames.gross} showNet={activeGames.net}
            />}
          </>
        )}
      </div>
    </>
  );
}

function TeamBlock({ teamAName, teamBName, teamAPlayers, teamBPlayers, scores, pars, handicaps, indices, teamAssignments, activeGames }: {
  teamAName: string; teamBName: string;
  teamAPlayers: typeof PLAYERS; teamBPlayers: typeof PLAYERS;
  scores: Record<PlayerId, number[]>; pars: number[]; handicaps: Record<PlayerId, number>;
  indices: number[]; teamAssignments: Record<PlayerId, Team>; activeGames: { teamMultiplier: boolean };
}) {
  const { totA, totB, mult } = teamTotals(PLAYERS, scores, pars, handicaps, indices, teamAssignments);
  const diff = totA - totB;

  return (
    <>
      {diff > 0 && (
        <div className="result-banner" style={{ background: 'rgba(78,186,122,0.1)', border: '1px solid rgba(78,186,122,0.25)' }}>
          <div className="result-label">Leading</div>
          <div className="result-text" style={{ color: 'var(--team-a)' }}>{teamAName}</div>
          <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 3 }}>{diff} pts ahead</div>
        </div>
      )}
      {diff < 0 && (
        <div className="result-banner" style={{ background: 'rgba(85,153,204,0.1)', border: '1px solid rgba(85,153,204,0.25)' }}>
          <div className="result-label">Leading</div>
          <div className="result-text" style={{ color: 'var(--team-b)' }}>{teamBName}</div>
          <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 3 }}>{Math.abs(diff)} pts ahead</div>
        </div>
      )}
      {diff === 0 && (
        <div className="result-banner" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div className="result-label">Status</div>
          <div className="result-text" style={{ color: 'var(--gold)' }}>All Square</div>
        </div>
      )}

      <div className="team-card team-a-card">
        <div className="team-name">{teamAName}</div>
        <div className="team-score-row">
          <span className="team-score-label">Combined Stableford Total</span>
          <span className="team-score-val" style={{ color: 'var(--team-a)' }}>{totA} pts</span>
        </div>
        {teamAPlayers.map(p => (
          <div key={p.id} className="team-score-row" style={{ marginTop: 3 }}>
            <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>{p.name}</span>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
              {totalStableford(p.id as PlayerId, scores, pars, handicaps, indices)} pts
            </span>
          </div>
        ))}
      </div>

      <div className="team-card team-b-card">
        <div className="team-name">{teamBName}</div>
        <div className="team-score-row">
          <span className="team-score-label">Combined Stableford Total</span>
          <span className="team-score-val" style={{ color: 'var(--team-b)' }}>{totB} pts</span>
        </div>
        {teamBPlayers.map(p => (
          <div key={p.id} className="team-score-row" style={{ marginTop: 3 }}>
            <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>{p.name}</span>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
              {totalStableford(p.id as PlayerId, scores, pars, handicaps, indices)} pts
            </span>
          </div>
        ))}
      </div>

      {activeGames.teamMultiplier && (
        <div className="card">
          <div className="card-title">✖️ Multiplier Breakdown</div>
          <div className="team-score-row" style={{ marginBottom: 7 }}>
            <span className="team-score-label">Running Total</span>
            <span className="team-score-val" style={{ color: 'var(--gold)' }}>{mult}</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', marginBottom: 7 }}>
            Combined team Stableford per hole × each other
          </div>
          {Array.from({ length: 18 }, (_, h) => {
            if (!PLAYERS.some(p => scores[p.id as PlayerId][h] > 0)) return null;
            const { sumA, sumB, product } = teamMultiplierHole(h, PLAYERS, scores, pars, handicaps, indices, teamAssignments);
            return (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gold)', minWidth: 28 }}>H{h + 1}</span>
                <span style={{ color: 'var(--team-a)', minWidth: 26, fontFamily: "'DM Mono', monospace" }}>{sumA}pt</span>
                <span style={{ color: 'rgba(245,240,232,0.3)' }}>×</span>
                <span style={{ color: 'var(--team-b)', minWidth: 26, fontFamily: "'DM Mono', monospace" }}>{sumB}pt</span>
                <span style={{ color: 'rgba(245,240,232,0.3)' }}>=</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: product > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.25)' }}>{product}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SkinsSection({ scores, pars, handicaps, indices }: {
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

function NassauSection({ teamAName, teamBName, scores, pars, handicaps, indices, teamAssignments }: {
  teamAName: string; teamBName: string;
  scores: Record<PlayerId, number[]>; pars: number[];
  handicaps: Record<PlayerId, number>; indices: number[];
  teamAssignments: Record<PlayerId, Team>;
}) {
  const n = calcNassau(PLAYERS, scores, pars, handicaps, indices, teamAssignments);
  let legsA = 0, legsB = 0;

  function Leg({ label, a, b }: { label: string; a: number; b: number }) {
    const win  = a > b ? 'A' : b > a ? 'B' : null;
    if (win === 'A') legsA++; else if (win === 'B') legsB++;
    const col  = win === 'A' ? 'var(--team-a)' : win === 'B' ? 'var(--team-b)' : 'var(--gold)';
    const name = win === 'A' ? teamAName : win === 'B' ? teamBName : 'Halved';
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)', minWidth: 52 }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--team-a)', fontSize: 12 }}>{a}pts</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{name}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--team-b)', fontSize: 12 }}>{b}pts</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">🏆 Nassau</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(245,240,232,0.35)', marginBottom: 8, padding: '0 2px' }}>
        <span style={{ color: 'var(--team-a)' }}>{teamAName}</span>
        <span style={{ color: 'var(--team-b)' }}>{teamBName}</span>
      </div>
      <Leg label="Front 9" a={n.front.a} b={n.front.b} />
      <Leg label="Back 9"  a={n.back.a}  b={n.back.b}  />
      <Leg label="Overall" a={n.full.a}  b={n.full.b}  />
      <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>Legs won:</span>
        <span style={{ fontSize: 11, color: 'var(--team-a)', fontWeight: 600 }}>{teamAName} {legsA}</span>
        <span style={{ fontSize: 11, color: 'var(--team-b)', fontWeight: 600 }}>{teamBName} {legsB}</span>
      </div>
    </div>
  );
}

function GrossNetSection({ scores, pars, handicaps, indices, showGross, showNet }: {
  scores: Record<PlayerId, number[]>; pars: number[];
  handicaps: Record<PlayerId, number>; indices: number[];
  showGross: boolean; showNet: boolean;
}) {
  const rows = [...PLAYERS].map(p => {
    const pid   = p.id as PlayerId;
    const gross = grossScore(pid, scores);
    const ph    = handicaps[pid];
    return { p, gross, net: gross > 0 ? gross - ph : 0, ph };
  }).sort((a, b) => showNet ? (a.net || 999) - (b.net || 999) : (a.gross || 999) - (b.gross || 999));

  const title = showGross && showNet ? '📊 Gross & Net' : showGross ? '📊 Gross' : '🏅 Net';

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)' }}>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 500 }} />
            {showGross && <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 500 }}>Gross</th>}
            {showNet   && <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 500 }}>Net</th>}
            {showNet   && <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 500 }}>HCP</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.p.id} style={i < rows.length - 1 ? { borderBottom: '1px solid rgba(245,240,232,0.05)' } : {}}>
              <td style={{ padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', width: 12 }}>{i + 1}</span>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.p.color }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.p.name}</span>
                </div>
              </td>
              {showGross && (
                <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: r.gross > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.2)' }}>
                  {r.gross || '—'}
                </td>
              )}
              {showNet && (
                <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: r.gross > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.2)' }}>
                  {r.gross > 0 ? r.net : '—'}
                </td>
              )}
              {showNet && (
                <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>{r.ph}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
