'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import { stablefordPoints, calcWolf, calcBestBall, calcAggregate, teamTotals, getPlayingHandicap } from '../../lib/scoring';
import { netScorePoints, threePlusPoints } from '../../lib/tour';
import type { HistoryRound } from '../../lib/db';
import { saveRoundToCloud, syncRoundsFromCloud, deleteRoundFromCloud, saveTourEvent, addHandicapScore, fetchTourEvents } from '../../lib/db';
import type { PlayerId, TourEvent } from '../../lib/types';
import { differential } from '../../lib/handicap';
import { EventResultsTable } from '../components/EventResultsTable';

function loadHistory(): HistoryRound[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('golf_history') || '[]'); } catch { return []; }
}

function saveHistoryLocal(rounds: HistoryRound[]) {
  localStorage.setItem('golf_history', JSON.stringify(rounds.slice(0, 50)));
}

function formatDate(d: string) {
  const dt     = new Date(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export default function HistoryPage() {
  const [rounds,   setRounds]   = useState<HistoryRound[]>([]);
  const [detail,   setDetail]   = useState<HistoryRound | null>(null);
  const [cloudMsg,       setCloudMsg]       = useState('');
  const [syncing,        setSyncing]        = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [tourModal, setTourModal] = useState<HistoryRound | null>(null);
  const [eventByRoundId, setEventByRoundId] = useState<Record<number, TourEvent>>({});

  const gameActive      = useGameStore(s => s.gameActive);
  const scores          = useGameStore(s => s.scores);
  const pars            = useGameStore(s => s.pars);
  const indices         = useGameStore(s => s.indices);
  const handicaps       = useGameStore(s => s.handicaps);
  const teamAssignments = useGameStore(s => s.teamAssignments);
  const courseRating    = useGameStore(s => s.courseRating);
  const slopeRating     = useGameStore(s => s.slopeRating);
  const courseName      = useGameStore(s => s.courseName);
  const compWinners     = useGameStore(s => s.compWinners);
  const activeGames     = useGameStore(s => s.activeGames);
  const wolfOrder       = useGameStore(s => s.wolfOrder);
  const wolfHoles       = useGameStore(s => s.wolfHoles);
  const wolfOverrides   = useGameStore(s => s.wolfOverrides);
  const selectedTee     = useGameStore(s => s.selectedTee);
  const threePutts      = useGameStore(s => s.threePutts);
  const isTourRound     = useGameStore(s => s.isTourRound);

  useEffect(() => {
    setRounds(loadHistory());
    syncCloud();
    fetchTourEvents().then(evts => {
      const map: Record<number, TourEvent> = {};
      for (const e of evts) if (e.roundId !== null) map[e.roundId] = e;
      setEventByRoundId(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const holesPlayed = Array.from({ length: 18 }, (_, h) =>
    PLAYERS.some(p => scores[p.id as PlayerId][h] > 0),
  ).filter(Boolean).length;

  async function saveRound() {
    if (!gameActive || holesPlayed === 0) return;
    const hist = loadHistory();
    const entry: HistoryRound = {
      id:             Date.now(),
      label:          courseName || 'Round',
      date:           new Date().toISOString(),
      holesPlayed,
      handicaps:      { ...handicaps },
      pars:           [...pars],
      indices:        [...indices],
      scores:         Object.fromEntries(PLAYERS.map(p => [p.id, [...scores[p.id as PlayerId]]])),
      compWinners:    JSON.parse(JSON.stringify(compWinners)),
      teamAssignments:{ ...teamAssignments },
      activeGames:    { ...activeGames },
      wolfOrder:      [...wolfOrder],
      wolfHoles:      JSON.parse(JSON.stringify(wolfHoles)),
      wolfOverrides:  { ...wolfOverrides },
      courseName,
      courseRating,
      slopeRating,
      selectedTee,
      threePutts:     Object.fromEntries(PLAYERS.map(p => [p.id, [...(threePutts[p.id as PlayerId] ?? [])]])),
      isTourRound,
    };
    hist.unshift(entry);
    const trimmed = hist.slice(0, 50);
    saveHistoryLocal(trimmed);
    setRounds(trimmed);

    setCloudMsg('☁️ Saving…');
    const result = await saveRoundToCloud(entry);
    if (result === 'saved') {
      setCloudMsg('✅ Saved to cloud');
    } else {
      setCloudMsg('⚠️ Cloud save failed — saved locally');
    }
    setTimeout(() => setCloudMsg(''), 3000);

    for (const pl of PLAYERS) {
      const gross = (entry.scores[pl.id] ?? []).reduce((s, v) => s + (v || 0), 0);
      if (gross === 0) continue;
      const diff = differential(gross, entry.courseRating, entry.slopeRating);
      await addHandicapScore({
        playerId: pl.id as PlayerId,
        date: entry.date.slice(0, 10),
        course: entry.courseName,
        score: gross,
        rating: entry.courseRating,
        slope: entry.slopeRating,
        differential: Math.round(diff * 10) / 10,
        source: 'app',
      });
    }

    setTourModal(entry);
  }

  async function syncCloud() {
    setSyncing(true);
    setCloudMsg('⏳ Syncing…');
    const local   = loadHistory();
    const merged  = await syncRoundsFromCloud(local);
    if (merged) {
      saveHistoryLocal(merged);
      setRounds(merged);
      const added = merged.length - local.length;
      setCloudMsg(added > 0 ? `✅ Synced (${added} new)` : '✅ Up to date');
    } else {
      setCloudMsg('⚠️ Sync failed');
    }
    setSyncing(false);
    setTimeout(() => setCloudMsg(''), 3000);
  }

  async function deleteRound(id: number) {
    const next = rounds.filter(r => r.id !== id);
    saveHistoryLocal(next);
    setRounds(next);
    setConfirmDeleteId(null);
    await deleteRoundFromCloud(id);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0', maxWidth: 480, margin: '0 auto' }}>
        <Link href="/setup" style={{ color: 'var(--gold)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', margin: 0, flex: 1 }}>History</h1>
        <Link href="/tour" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 6, padding: '4px 10px' }}>🏅 Tour</Link>
      </div>
      <div className="card-page-wrap">
        {gameActive && holesPlayed > 0 ? (
          <button className="save-round-btn" onClick={saveRound}>
            ☁️ Save round ({holesPlayed} holes)
          </button>
        ) : gameActive ? (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.25)', marginBottom: 12 }}>
            Enter scores on the Score tab, then save here.
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '5px 10px', marginBottom: 0 }}
            onClick={syncCloud}
            disabled={syncing}
          >
            ☁️ Sync from cloud
          </button>
          {cloudMsg && (
            <span style={{ fontSize: 11, color: cloudMsg.startsWith('✅') ? 'var(--green-bright)' : cloudMsg.startsWith('⚠️') ? 'var(--red)' : 'var(--gold)' }}>
              {cloudMsg}
            </span>
          )}
        </div>

        <div className="card-title" style={{ marginBottom: 10 }}>📚 Past Rounds</div>

        {rounds.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            No saved rounds yet.<br />Finish a round and tap &quot;Save Round&quot; above.
          </div>
        ) : (
          rounds.map(r => (
            <RoundCard
              key={r.id}
              r={r}
              event={eventByRoundId[r.id]}
              onOpen={() => setDetail(r)}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              onDelete={deleteRound}
              onAddToTour={() => setTourModal(r)}
            />
          ))
        )}
      </div>

      {detail && <HistoryDetail round={detail} event={eventByRoundId[detail.id]} onClose={() => setDetail(null)} />}
      {tourModal && <TourEventModal round={tourModal} onClose={() => setTourModal(null)} />}
    </>
  );
}

function RoundCard({
  r, event, onOpen, confirmDeleteId, setConfirmDeleteId, onDelete, onAddToTour,
}: {
  r: HistoryRound;
  event?: TourEvent;
  onOpen: () => void;
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
  onDelete: (id: number) => void;
  onAddToTour: () => void;
}) {
  const onTour = !!(event || r.isTourRound);
  return (
    <div className="history-round" onClick={onOpen}>
      <div className="history-round-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <div className="history-round-date">{r.label}</div>
            {(event || r.isTourRound) && (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: 0.4, padding: '2px 5px', borderRadius: 3,
                background: 'rgba(201,168,76,0.12)', color: 'var(--gold)',
                border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0,
              }}>🏅 DE Tour</span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: 0.4, padding: '2px 5px', borderRadius: 3,
              background: event?.source === 'excel' ? 'rgba(201,168,76,0.12)' : 'rgba(78,186,122,0.15)',
              color: event?.source === 'excel' ? 'rgba(201,168,76,0.7)' : 'var(--green-bright)',
              border: event?.source === 'excel' ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(78,186,122,0.3)',
              flexShrink: 0,
            }}>{event?.source === 'excel' ? '📊 Excel' : '📱 App'}</span>
          </div>
          <div className="history-round-holes">{formatDate(r.date)} · {r.holesPlayed} holes</div>
        </div>
        {confirmDeleteId === r.id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.6)' }}>Delete?</span>
            <button
              style={{ fontSize: 11, padding: '3px 8px', background: 'var(--red)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
              onClick={() => onDelete(r.id)}
            >Yes</button>
            <button
              style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(245,240,232,0.1)', border: '1px solid rgba(245,240,232,0.2)', borderRadius: 4, color: 'var(--cream)', cursor: 'pointer' }}
              onClick={() => setConfirmDeleteId(null)}
            >No</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {!onTour && (
              <button
                style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.35)',
                  whiteSpace: 'nowrap',
                }}
                onClick={e => { e.stopPropagation(); onAddToTour(); }}
              >🏅 Add to Tour</button>
            )}
            <button
              className="history-delete-btn"
              onClick={e => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
            >🗑</button>
          </div>
        )}
      </div>

      {event ? <EventResultsTable event={event} round={r} /> : <RoundResultsTable r={r} />}
    </div>
  );
}

// ─── Round Results Table (shared by RoundCard + HistoryDetail) ────────────────

function RoundResultsTable({ r }: { r: HistoryRound }) {
  const ta = (r.teamAssignments || {}) as Record<string, 'A' | 'B'>;
  const ag = r.activeGames || {};
  const isWolf = !!(ag.wolf && r.wolfOrder?.length);

  // Wolf totals
  const wolfTotals: Record<string, number> = {};
  if (isWolf) {
    for (const hr of calcWolf(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, r.wolfOrder!, r.wolfHoles || [], r.wolfOverrides ?? {})) {
      for (const [pid, v] of Object.entries(hr.pm)) wolfTotals[pid] = (wolfTotals[pid] ?? 0) + v;
    }
  }
  const wolfWinners = new Set<string>();
  if (isWolf) {
    const ranked = [...PLAYERS].sort((a, b) => (wolfTotals[b.id] ?? 0) - (wolfTotals[a.id] ?? 0));
    wolfWinners.add(ranked[0]?.id ?? '');
    if (ranked[1]) wolfWinners.add(ranked[1].id);
  }

  // Team winner + score
  let teamWinner: 'A' | 'B' | null = null;
  let teamScore: { A: number; B: number } | null = null;
  let teamFmt = 'Stableford';
  if (!isWolf) {
    if (ag.teamMultiplier) {
      const t = teamTotals(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta);
      teamScore = { A: t.totA, B: t.totB };
      teamWinner = t.totA > t.totB ? 'A' : t.totB > t.totA ? 'B' : null;
      teamFmt = 'Multiplier';
    } else if (ag.bestBall) {
      const bbNoSI = r.indices?.length === 18 && r.indices.every(i => i === 0);
      const bb = calcBestBall(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta, bbNoSI);
      const isGross = bb.mode === 'gross';
      teamScore = { A: bb.totA, B: bb.totB };
      teamWinner = isGross
        ? (bb.totA < bb.totB ? 'A' : bb.totB < bb.totA ? 'B' : null)
        : (bb.totA > bb.totB ? 'A' : bb.totB > bb.totA ? 'B' : null);
      teamFmt = 'Best Ball';
    } else if (ag.aggregate) {
      const agg = calcAggregate(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta);
      teamScore = { A: agg.totA, B: agg.totB };
      teamWinner = agg.totA > agg.totB ? 'A' : agg.totB > agg.totA ? 'B' : null;
      teamFmt = 'Aggregate';
    }
  }

  const teamAPlayers = PLAYERS.filter(p => ta[p.id] === 'A');
  const teamBPlayers = PLAYERS.filter(p => ta[p.id] === 'B');
  const hasTeams = teamAPlayers.length > 0 && teamBPlayers.length > 0 && !isWolf;

  // Round-wide CTP/LD winner: most per-hole wins, strictly ahead of everyone else (tie = no winner)
  const ctpWinnerId = tallyCompWinner(r, 'ctp');
  const ldWinnerId  = tallyCompWinner(r, 'ld');

  // Per-player computed data
  const playerData = PLAYERS.map(pl => {
    const pid = pl.id;
    const gross = r.scores[pid]?.reduce((s, v) => s + (v > 0 ? v : 0), 0) ?? 0;
    const ph = getPlayingHandicap(pid, r.handicaps, r.courseRating ?? 71, r.slopeRating ?? 113, r.pars);
    const net = gross > 0 ? gross - ph : 0;
    const stbl = r.scores[pid]?.reduce((sum, s, h) =>
      sum + (stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices) ?? 0), 0) ?? 0;
    const threePuttCount = (r.threePutts?.[pid] ?? []).filter(Boolean).length;
    const bracketPts = gross > 0 ? netScorePoints(net) : 0;
    const threePlusCount = threePlusPoints(pid, r.scores, r.pars, r.handicaps, r.indices);
    const ctpPts = ctpWinnerId === pid ? 5 : 0;
    const ldPts  = ldWinnerId  === pid ? 5 : 0;
    const teamPts = isWolf
      ? (wolfWinners.has(pid) ? 10 : 0)
      : (hasTeams && teamWinner !== null && ta[pid] === teamWinner ? 10 : 0);
    const total = bracketPts + teamPts + threePlusCount + ldPts + ctpPts;
    return { pl, pid, gross, net, stbl, threePuttCount, bracketPts, threePlusCount, ctpPts, ldPts, teamPts, total };
  });

  // Stableford team fallback (teams without multiplier/bestBall/aggregate)
  if (!teamScore && hasTeams) {
    const sum = (team: 'A' | 'B') =>
      playerData.filter(pd => ta[pd.pid] === team).reduce((s, pd) => s + pd.stbl, 0);
    teamScore = { A: sum('A'), B: sum('B') };
  }

  const thR: React.CSSProperties = { textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', paddingBottom: 5, fontWeight: 500, paddingLeft: 6 };
  const mono: React.CSSProperties = { textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, paddingLeft: 6 };
  const dividerCell: React.CSSProperties = { borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 };
  const preDivider: React.CSSProperties = { paddingRight: 8 };
  const scoringCols = isWolf ? 6 : 5;
  const pointsCols = 6;
  const totalCols = scoringCols + pointsCols;

  function Dot({ pid, size = 18 }: { pid: string; size?: number }) {
    const pl = PLAYERS.find(p => p.id === pid);
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: pl?.color ?? '#888', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, fontWeight: 700, color: '#0d2818', flexShrink: 0 }}>
        {pl?.name[0]}
      </div>
    );
  }

  function renderTeamHeader(team: 'A' | 'B') {
    const isWinner = teamWinner === team;
    const players = team === 'A' ? teamAPlayers : teamBPlayers;
    const score = teamScore ? teamScore[team] : null;
    return (
      <tr key={`team-${team}`} style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <td colSpan={totalCols} style={{ paddingTop: 5, paddingBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {players.map(p => <Dot key={p.id} pid={p.id} size={14} />)}
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{teamFmt}</span>
            {score !== null && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: isWinner ? 'var(--green-bright)' : 'rgba(245,240,232,0.5)' }}>{score}</span>}
            {isWinner && <span style={{ fontSize: 10, color: 'var(--green-bright)', marginLeft: 2 }}>✓ Win</span>}
          </div>
        </td>
      </tr>
    );
  }

  function renderPlayerRow(pd: typeof playerData[0]) {
    const { pl, pid, gross, net, stbl, threePuttCount, bracketPts, threePlusCount, ctpPts, ldPts, teamPts, total } = pd;
    return (
      <tr key={pid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <td style={{ paddingTop: 7, paddingBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot pid={pid} size={18} />
            <span style={{ fontSize: 12, color: pl.color }}>{pl.name}</span>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{r.handicaps[pid] ?? 0}</span>
          </div>
        </td>
        <td style={mono}>{gross > 0 ? gross : '—'}</td>
        <td style={mono}>{net > 0 ? net : '—'}</td>
        <td style={mono}>{gross > 0 ? stbl : '—'}</td>
        {isWolf && <td style={{ ...mono, color: 'var(--cream)' }}>{wolfTotals[pid] ?? 0}</td>}
        <td style={{ ...mono, ...preDivider, color: threePuttCount > 0 ? '#e88' : 'rgba(245,240,232,0.3)' }}>{threePuttCount > 0 ? threePuttCount : '—'}</td>
        <td style={{ ...mono, ...dividerCell, color: 'var(--cream)' }}>{bracketPts > 0 ? bracketPts : '—'}</td>
        <td style={{ ...mono, color: teamPts > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{teamPts > 0 ? teamPts : '—'}</td>
        <td style={{ ...mono, color: threePlusCount > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.3)' }}>{threePlusCount > 0 ? threePlusCount : '—'}</td>
        <td style={{ ...mono, color: ldPts > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{ldPts > 0 ? ldPts : '—'}</td>
        <td style={{ ...mono, color: ctpPts > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{ctpPts > 0 ? ctpPts : '—'}</td>
        <td style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{total > 0 ? total : '—'}</td>
      </tr>
    );
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead>
          <tr>
            <th colSpan={scoringCols} style={{ textAlign: 'left', fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', paddingBottom: 3 }}>Scoring</th>
            <th colSpan={pointsCols} style={{ textAlign: 'left', fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', paddingBottom: 3, paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>Points</th>
          </tr>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign: 'left', fontSize: 10, color: 'rgba(245,240,232,0.35)', paddingBottom: 5, fontWeight: 500 }}>Player</th>
            <th style={thR}>Gross</th>
            <th style={thR}>Net</th>
            <th style={thR}>Stbl</th>
            {isWolf && <th style={thR}>Wolf</th>}
            <th style={{ ...thR, ...preDivider }}>3P</th>
            <th style={{ ...thR, ...dividerCell }}>Pts</th>
            <th style={thR}>Team</th>
            <th style={thR}>3+</th>
            <th style={thR}>LD</th>
            <th style={thR}>CTP</th>
            <th style={{ ...thR, color: 'rgba(201,168,76,0.6)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {isWolf ? (
            playerData.map(pd => renderPlayerRow(pd))
          ) : hasTeams ? (
            <>
              {renderTeamHeader('A')}
              {playerData.filter(pd => ta[pd.pid] === 'A').map(pd => renderPlayerRow(pd))}
              {renderTeamHeader('B')}
              {playerData.filter(pd => ta[pd.pid] === 'B').map(pd => renderPlayerRow(pd))}
            </>
          ) : (
            playerData.map(pd => renderPlayerRow(pd))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Hole-by-Hole Table (full detail: every score, pts, 3-putts, CTP/LD, Wolf) ─

function HoleByHoleTable({ r }: { r: HistoryRound }) {
  const ag = r.activeGames || {};
  const isWolf = !!(ag.wolf && r.wolfOrder?.length);
  const wolfResults = isWolf
    ? calcWolf(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, r.wolfOrder!, r.wolfHoles || [], r.wolfOverrides ?? {})
    : [];

  const holes = Array.from({ length: 18 }, (_, h) => h);
  const playedHoles = holes.filter(h => PLAYERS.some(p => r.scores[p.id]?.[h] > 0));
  const frontHoles = playedHoles.filter(h => h < 9);
  const backHoles  = playedHoles.filter(h => h >= 9);

  function playerName(pid: string) { return PLAYERS.find(p => p.id === pid)?.name ?? pid; }
  function playerColor(pid: string) { return PLAYERS.find(p => p.id === pid)?.color ?? '#888'; }

  function ptsColor(pts: number | null) {
    if (pts === null) return 'rgba(245,240,232,0.15)';
    if (pts >= 4) return 'var(--gold)';
    if (pts === 3) return 'var(--green-bright)';
    if (pts === 2) return 'var(--cream)';
    if (pts === 1) return 'rgba(245,240,232,0.4)';
    return 'var(--red)';
  }

  const th: React.CSSProperties = { textAlign: 'center', fontSize: 9, color: 'rgba(245,240,232,0.35)', padding: '0 3px 4px', fontWeight: 500 };
  const td: React.CSSProperties = { textAlign: 'center', padding: '3px', verticalAlign: 'top', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  const ldHoles  = playedHoles.filter(h => r.compWinners?.[h]?.ld  && r.compWinners[h].ld  !== 'none');
  const ctpHoles = playedHoles.filter(h => r.compWinners?.[h]?.ctp && r.compWinners[h].ctp !== 'none');
  const threePuttRows = PLAYERS
    .map(pl => ({ pl, holes: playedHoles.filter(h => r.threePutts?.[pl.id]?.[h]) }))
    .filter(row => row.holes.length > 0);
  const wolfHolesUsed = isWolf ? wolfResults.filter(wr => wr.mode && playedHoles.includes(wr.hole)) : [];

  function sectionSum(pid: string, holesSet: number[]) {
    const gross = holesSet.reduce((s, h) => s + (r.scores[pid]?.[h] > 0 ? r.scores[pid][h] : 0), 0);
    const stbl  = holesSet.reduce((s, h) => {
      const sc = r.scores[pid]?.[h] ?? 0;
      if (!sc) return s;
      return s + (stablefordPoints(sc, r.pars[h], pid, h, r.handicaps, r.indices) ?? 0);
    }, 0);
    return { gross, stbl };
  }

  const sumCell: React.CSSProperties = { ...td, background: 'rgba(201,168,76,0.06)', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-title">🏌️ Hole-by-Hole</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 4 }}>Hole</th>
              {frontHoles.map(h => <th key={h} style={th}>{h + 1}</th>)}
              {frontHoles.length > 0 && <th style={{ ...th, color: 'rgba(201,168,76,0.6)' }}>Out</th>}
              {backHoles.map(h => <th key={h} style={th}>{h + 1}</th>)}
              {backHoles.length > 0 && <th style={{ ...th, color: 'rgba(201,168,76,0.6)' }}>In</th>}
              <th style={{ ...th, color: 'rgba(201,168,76,0.6)' }}>Tot</th>
            </tr>
            <tr>
              <td style={{ ...td, textAlign: 'left', paddingLeft: 4, color: 'rgba(245,240,232,0.35)', fontSize: 10 }}>Par</td>
              {frontHoles.map(h => <td key={h} style={{ ...td, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{r.pars[h]}</td>)}
              {frontHoles.length > 0 && <td style={{ ...sumCell, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{frontHoles.reduce((s, h) => s + r.pars[h], 0)}</td>}
              {backHoles.map(h => <td key={h} style={{ ...td, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{r.pars[h]}</td>)}
              {backHoles.length > 0 && <td style={{ ...sumCell, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{backHoles.reduce((s, h) => s + r.pars[h], 0)}</td>}
              <td style={{ ...td, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{playedHoles.reduce((s, h) => s + r.pars[h], 0)}</td>
            </tr>
            <tr>
              <td style={{ ...td, textAlign: 'left', paddingLeft: 4, color: 'rgba(245,240,232,0.25)', fontSize: 10 }}>SI</td>
              {frontHoles.map(h => <td key={h} style={{ ...td, fontSize: 10, color: 'rgba(245,240,232,0.25)' }}>{r.indices[h] || '–'}</td>)}
              {frontHoles.length > 0 && <td style={{ ...sumCell, fontSize: 10 }}>–</td>}
              {backHoles.map(h => <td key={h} style={{ ...td, fontSize: 10, color: 'rgba(245,240,232,0.25)' }}>{r.indices[h] || '–'}</td>)}
              {backHoles.length > 0 && <td style={{ ...sumCell, fontSize: 10 }}>–</td>}
              <td style={{ ...td, fontSize: 10 }}>–</td>
            </tr>
          </thead>
          <tbody>
            {PLAYERS.map(pl => {
              const pid = pl.id;
              const gross = r.scores[pid]?.reduce((s, v) => s + (v > 0 ? v : 0), 0) ?? 0;
              const out = sectionSum(pid, frontHoles);
              const inn = sectionSum(pid, backHoles);
              return (
                <tr key={pid}>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: pl.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: pl.color }}>{pl.name}</span>
                    </span>
                  </td>
                  {frontHoles.map(h => {
                    const s = r.scores[pid]?.[h] ?? 0;
                    const pts = s > 0 ? stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices) : null;
                    const putt3 = !!r.threePutts?.[pid]?.[h];
                    return (
                      <td key={h} style={td}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: s > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.15)' }}>
                          {s > 0 ? s : '—'}
                        </div>
                        {s > 0 && <div style={{ fontSize: 8, color: ptsColor(pts), lineHeight: '10px' }}>{pts}</div>}
                        {putt3 && <div style={{ fontSize: 7, color: 'var(--red)', lineHeight: '9px' }}>3P</div>}
                      </td>
                    );
                  })}
                  {frontHoles.length > 0 && (
                    <td style={sumCell}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: out.gross > 0 ? 'var(--gold)' : 'rgba(245,240,232,0.15)' }}>
                        {out.gross > 0 ? out.gross : '—'}
                      </div>
                      {out.gross > 0 && <div style={{ fontSize: 8, color: 'var(--green-bright)', lineHeight: '10px' }}>{out.stbl}</div>}
                    </td>
                  )}
                  {backHoles.map(h => {
                    const s = r.scores[pid]?.[h] ?? 0;
                    const pts = s > 0 ? stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices) : null;
                    const putt3 = !!r.threePutts?.[pid]?.[h];
                    return (
                      <td key={h} style={td}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: s > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.15)' }}>
                          {s > 0 ? s : '—'}
                        </div>
                        {s > 0 && <div style={{ fontSize: 8, color: ptsColor(pts), lineHeight: '10px' }}>{pts}</div>}
                        {putt3 && <div style={{ fontSize: 7, color: 'var(--red)', lineHeight: '9px' }}>3P</div>}
                      </td>
                    );
                  })}
                  {backHoles.length > 0 && (
                    <td style={sumCell}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: inn.gross > 0 ? 'var(--gold)' : 'rgba(245,240,232,0.15)' }}>
                        {inn.gross > 0 ? inn.gross : '—'}
                      </div>
                      {inn.gross > 0 && <div style={{ fontSize: 8, color: 'var(--green-bright)', lineHeight: '10px' }}>{inn.stbl}</div>}
                    </td>
                  )}
                  <td style={td}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: gross > 0 ? 'var(--gold)' : 'rgba(245,240,232,0.15)' }}>
                      {gross > 0 ? gross : '—'}
                    </div>
                    {gross > 0 && <div style={{ fontSize: 9, color: 'var(--green-bright)', lineHeight: '11px' }}>{out.stbl + inn.stbl}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.25)', marginTop: 4 }}>Top: shots · middle: Stableford pts · 3P: three-putt</div>

      {threePuttRows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>🎯 Three-Putts</div>
          {threePuttRows.map(({ pl, holes: hs }) => (
            <div key={pl.id} style={{ display: 'flex', gap: 10, fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
              <span style={{ color: pl.color, width: 60, flexShrink: 0 }}>{pl.name}</span>
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>{hs.length}</span>
              <span style={{ color: 'rgba(245,240,232,0.35)' }}>Hole{hs.length > 1 ? 's' : ''} {hs.map(h => h + 1).join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {ldHoles.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>🏌️ Long Drive</div>
          {ldHoles.map(h => {
            const pid = r.compWinners![h].ld;
            return (
              <div key={h} style={{ display: 'flex', gap: 10, fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                <span style={{ width: 46, color: 'rgba(245,240,232,0.35)', flexShrink: 0 }}>Hole {h + 1}</span>
                <span style={{ color: playerColor(pid) }}>{playerName(pid)}</span>
              </div>
            );
          })}
        </div>
      )}

      {ctpHoles.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>📍 Par 3 Comp (CTP)</div>
          {ctpHoles.map(h => {
            const pid = r.compWinners![h].ctp;
            return (
              <div key={h} style={{ display: 'flex', gap: 10, fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                <span style={{ width: 46, color: 'rgba(245,240,232,0.35)', flexShrink: 0 }}>Hole {h + 1} (Par {r.pars[h]})</span>
                <span style={{ color: playerColor(pid) }}>{playerName(pid)}</span>
              </div>
            );
          })}
        </div>
      )}

      {isWolf && wolfHolesUsed.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>🐺 Wolf</div>
          {wolfHolesUsed.map(wr => {
            const winners = Object.entries(wr.pm).filter(([, v]) => v > 0);
            return (
              <div key={wr.hole} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ width: 46, color: 'rgba(245,240,232,0.35)', flexShrink: 0 }}>Hole {wr.hole + 1}</span>
                <span>Wolf: <span style={{ color: playerColor(wr.wolfId!) }}>{playerName(wr.wolfId!)}</span></span>
                <span style={{ color: 'rgba(245,240,232,0.35)' }}>
                  {wr.mode}{wr.partnerId ? ` w/ ${playerName(wr.partnerId)}` : ''}
                </span>
                {winners.length > 0
                  ? winners.map(([pid, v]) => (
                      <span key={pid} style={{ color: 'var(--green-bright)' }}>{playerName(pid)} +{v}</span>
                    ))
                  : <span style={{ color: 'rgba(245,240,232,0.25)' }}>push</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistoryDetail({ round: r, event, onClose }: { round: HistoryRound; event?: TourEvent; onClose: () => void }) {
  const ta = (r.teamAssignments || {}) as Record<string, 'A' | 'B'>;
  const ag = r.activeGames || {};
  const isWolf = event
    ? (!event.teamWinner && r.activeGames?.wolf === true)
    : !!(ag.wolf && r.wolfOrder?.length);

  // Team winner (for banner) — prefer linked tour event so it matches the Tour page
  let teamWinner: 'A' | 'B' | null = null;
  if (event) {
    teamWinner = event.teamWinner;
  } else if (!isWolf) {
    if (ag.teamMultiplier) {
      const t = teamTotals(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta);
      teamWinner = t.totA > t.totB ? 'A' : t.totB > t.totA ? 'B' : null;
    } else if (ag.bestBall) {
      const bbNoSI = r.indices?.length === 18 && r.indices.every(i => i === 0);
      const bb = calcBestBall(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta, bbNoSI);
      const isGross = bb.mode === 'gross';
      teamWinner = isGross
        ? (bb.totA < bb.totB ? 'A' : bb.totB < bb.totA ? 'B' : null)
        : (bb.totA > bb.totB ? 'A' : bb.totB > bb.totA ? 'B' : null);
    } else if (ag.aggregate) {
      const agg = calcAggregate(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta);
      teamWinner = agg.totA > agg.totB ? 'A' : agg.totB > agg.totA ? 'B' : null;
    }
  }

  const teamAPlayers = event
    ? PLAYERS.filter(p => event.teamA.includes(p.id as PlayerId))
    : PLAYERS.filter(p => ta[p.id] === 'A');
  const teamBPlayers = event
    ? PLAYERS.filter(p => event.teamB.includes(p.id as PlayerId))
    : PLAYERS.filter(p => ta[p.id] === 'B');
  const hasTeams = teamAPlayers.length > 0 && teamBPlayers.length > 0 && !isWolf;

  const hdTeamAName = teamAPlayers.map(p => p.name).join(' & ') || 'Team A';
  const hdTeamBName = teamBPlayers.map(p => p.name).join(' & ') || 'Team B';

  return (
    <div className="history-detail-overlay">
      <div className="history-detail-header">
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--cream)', fontSize: 18, cursor: 'pointer', padding: '2px 6px' }}>←</button>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: 'var(--gold)' }}>{r.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', letterSpacing: 1, textTransform: 'uppercase' }}>{formatDate(r.date)} · {r.holesPlayed} holes</div>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        {hasTeams && teamWinner === 'A' && (
          <div className="result-banner" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <div className="result-label">Winner</div>
            <div className="result-text" style={{ color: 'var(--team-a)' }}>{hdTeamAName}</div>
          </div>
        )}
        {hasTeams && teamWinner === 'B' && (
          <div className="result-banner" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <div className="result-label">Winner</div>
            <div className="result-text" style={{ color: 'var(--team-b)' }}>{hdTeamBName}</div>
          </div>
        )}
        {hasTeams && teamWinner === null && (
          <div className="result-banner" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="result-label">Result</div>
            <div className="result-text" style={{ color: 'var(--gold)' }}>All Square</div>
          </div>
        )}

        <div className="card">
          {event ? <EventResultsTable event={event} round={r} /> : <RoundResultsTable r={r} />}
        </div>

        <HoleByHoleTable r={r} />

        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', textAlign: 'center', marginTop: 8 }}>
          {PLAYERS.map(p => `${p.name} HCP ${r.handicaps[p.id]}`).join(' · ')}
        </div>
      </div>
    </div>
  );
}

// ─── Tour Event Modal ─────────────────────────────────────────────────────────

// Tallies per-hole comp wins (round.compWinners) and returns the outright leader.
// A player only scores the 5 comp points if they have strictly more hole-wins
// than everyone else — a tie (e.g. 1-1) awards no points.
function tallyCompWinner(round: HistoryRound, field: 'ctp' | 'ld'): PlayerId | null {
  const counts: Partial<Record<PlayerId, number>> = {};
  for (const cw of Object.values(round.compWinners || {})) {
    const pid = cw?.[field];
    if (!pid || pid === 'none') continue;
    counts[pid as PlayerId] = (counts[pid as PlayerId] ?? 0) + 1;
  }
  const entries = Object.entries(counts) as [PlayerId, number][];
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

function compTallyText(round: HistoryRound, field: 'ctp' | 'ld'): string {
  const counts: Partial<Record<PlayerId, number>> = {};
  for (const cw of Object.values(round.compWinners || {})) {
    const pid = cw?.[field];
    if (!pid || pid === 'none') continue;
    counts[pid as PlayerId] = (counts[pid as PlayerId] ?? 0) + 1;
  }
  const entries = Object.entries(counts) as [PlayerId, number][];
  if (entries.length === 0) return 'no hole winners recorded';
  entries.sort((a, b) => b[1] - a[1]);
  const parts = entries.map(([pid, n]) => `${PLAYERS.find(p => p.id === pid)?.name ?? pid} ${n}`);
  const tied = entries.length > 1 && entries[0][1] === entries[1][1];
  return parts.join(' · ') + (tied ? ' — tied, no points' : '');
}

function TourEventModal({ round, onClose }: { round: HistoryRound; onClose: () => void }) {
  const PLAYER_IDS = PLAYERS.map(p => p.id as PlayerId);
  const [teamA, setTeamA] = useState<PlayerId[]>([PLAYER_IDS[0], PLAYER_IDS[1]]);
  const [teamFormat, setTeamFormat] = useState<'multiplier' | 'worstBall' | 'bestBall'>('multiplier');
  const [teamWinner, setTeamWinner] = useState<'A' | 'B' | null>(null);
  const [ctpWinner, setCtpWinner] = useState<PlayerId | null>(() => tallyCompWinner(round, 'ctp'));
  const [ldWinner, setLdWinner] = useState<PlayerId | null>(() => tallyCompWinner(round, 'ld'));
  const [poopWinner, setPoopWinner] = useState<PlayerId | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const teamB = PLAYER_IDS.filter(p => !teamA.includes(p));

  function toggleTeamA(pid: PlayerId) {
    if (teamA.includes(pid)) {
      if (teamA.length > 1) setTeamA(teamA.filter(p => p !== pid));
    } else {
      if (teamA.length < 3) setTeamA([...teamA, pid]);
    }
  }

  async function save() {
    setSaving(true);
    const month = new Date(round.date).toLocaleString('en-AU', { month: 'long' });
    const season = new Date(round.date).getFullYear();
    const threePuttCounts = Object.fromEntries(
      PLAYER_IDS.map(pid => [pid, (round.threePutts[pid] ?? []).filter(Boolean).length]),
    ) as Record<PlayerId, number>;
    const event: TourEvent = {
      id: `${season}-${round.id}`,
      month,
      season,
      courseName: round.courseName,
      date: round.date.slice(0, 10),
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      par: round.pars.reduce((s, p) => s + p, 0),
      teamA,
      teamB,
      teamFormat,
      teamWinner,
      ctpWinner,
      ldWinner,
      roundHandicaps: round.handicaps as Record<PlayerId, number>,
      threePuttCounts,
      poopWinner,
      roundId: round.id,
      source: 'app' as const,
    };
    await saveTourEvent(event);
    for (const pl of PLAYERS) {
      const gross = (round.scores[pl.id] ?? []).reduce((s, v) => s + (v || 0), 0);
      if (gross === 0) continue;
      const diff = differential(gross, round.courseRating, round.slopeRating);
      await addHandicapScore({
        playerId: pl.id as PlayerId,
        date: round.date.slice(0, 10),
        course: round.courseName,
        score: gross,
        rating: round.courseRating,
        slope: round.slopeRating,
        differential: Math.round(diff * 10) / 10,
      });
    }
    setSaving(false);
    setMsg('✅ Tour event saved!');
    setTimeout(onClose, 1400);
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom,0)',
  };
  const sheet: React.CSSProperties = {
    background: 'var(--green-deep)', border: '1px solid rgba(201,168,76,0.3)',
    borderRadius: '16px 16px 0 0', padding: '20px 18px 32px', width: '100%', maxWidth: 480,
  };
  const label: React.CSSProperties = { fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 6, display: 'block' };
  const row: React.CSSProperties = { marginBottom: 16 };

  const chipBase: React.CSSProperties = {
    fontSize: 12, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.3)',
    cursor: 'pointer', background: 'rgba(0,0,0,0.2)', color: 'var(--cream)',
  };
  const chipActive: React.CSSProperties = {
    ...chipBase, background: 'rgba(201,168,76,0.2)', borderColor: 'var(--gold)', color: 'var(--gold)', fontWeight: 600,
  };

  function PlayerChips({ value, onChange, nullable }: {
    value: PlayerId | null;
    onChange: (v: PlayerId | null) => void;
    nullable?: boolean;
  }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {nullable && (
          <button style={value === null ? chipActive : chipBase} onClick={() => onChange(null)}>None</button>
        )}
        {PLAYERS.map(pl => (
          <button
            key={pl.id}
            style={value === pl.id ? { ...chipActive, borderColor: pl.color, color: pl.color } : chipBase}
            onClick={() => onChange(pl.id as PlayerId)}
          >
            {pl.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={sheet}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--gold)' }}>
            🏅 Add to DE Tour
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', marginBottom: 16 }}>
          {round.courseName} · {new Date(round.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        <div style={row}>
          <span style={label}>Team A players</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLAYERS.map(pl => (
              <button
                key={pl.id}
                style={teamA.includes(pl.id as PlayerId)
                  ? { ...chipActive, borderColor: pl.color, color: pl.color }
                  : chipBase}
                onClick={() => toggleTeamA(pl.id as PlayerId)}
              >
                {pl.name}
              </button>
            ))}
          </div>
          {teamB.length > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 5 }}>
              Team B: {teamB.map(p => PLAYERS.find(pl => pl.id === p)?.name).join(', ')}
            </div>
          )}
        </div>

        <div style={row}>
          <span style={label}>Team format</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['multiplier', 'worstBall', 'bestBall'] as const).map(f => (
              <button key={f} style={teamFormat === f ? chipActive : chipBase} onClick={() => setTeamFormat(f)}>
                {f === 'multiplier' ? 'Multiplier' : f === 'worstBall' ? 'Worst Ball' : 'Best Ball'}
              </button>
            ))}
          </div>
        </div>

        <div style={row}>
          <span style={label}>Team winner</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['A', 'B', null] as const).map(v => (
              <button key={String(v)} style={teamWinner === v ? chipActive : chipBase} onClick={() => setTeamWinner(v)}>
                {v === null ? 'Draw' : `Team ${v}`}
              </button>
            ))}
          </div>
        </div>

        <div style={row}>
          <span style={label}>📍 CTP winner</span>
          <PlayerChips value={ctpWinner} onChange={setCtpWinner} nullable />
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 5 }}>{compTallyText(round, 'ctp')}</div>
        </div>

        <div style={row}>
          <span style={label}>🏌️ LD winner</span>
          <PlayerChips value={ldWinner} onChange={setLdWinner} nullable />
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 5 }}>{compTallyText(round, 'ld')}</div>
        </div>

        <div style={row}>
          <span style={label}>💩 Poop trophy</span>
          <PlayerChips value={poopWinner} onChange={setPoopWinner} nullable />
        </div>

        {msg ? (
          <div style={{ textAlign: 'center', color: 'var(--green-bright)', fontSize: 14, padding: '8px 0' }}>{msg}</div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Skip</button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : '🏅 Save Tour Event'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
