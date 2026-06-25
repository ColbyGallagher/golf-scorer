'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import { stablefordPoints, calcSkins, calcWolf, calcNassau, getPlayingHandicap } from '../../lib/scoring';
import type { HistoryRound } from '../../lib/db';
import { saveRoundToCloud, syncRoundsFromCloud, deleteRoundFromCloud } from '../../lib/db';
import type { PlayerId } from '../../lib/types';

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

function roundStableford(r: HistoryRound, pid: string): number {
  return r.scores[pid]?.reduce((sum, s, h) =>
    sum + (stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices) ?? 0), 0) ?? 0;
}

export default function HistoryPage() {
  const [rounds,   setRounds]   = useState<HistoryRound[]>([]);
  const [detail,   setDetail]   = useState<HistoryRound | null>(null);
  const [cloudMsg,       setCloudMsg]       = useState('');
  const [syncing,        setSyncing]        = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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
  const selectedTee     = useGameStore(s => s.selectedTee);
  const threePutts      = useGameStore(s => s.threePutts);

  useEffect(() => {
    setRounds(loadHistory());
    syncCloud();
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
      courseName,
      courseRating,
      slopeRating,
      selectedTee,
      threePutts:     Object.fromEntries(PLAYERS.map(p => [p.id, [...(threePutts[p.id as PlayerId] ?? [])]])),
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
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', margin: 0 }}>History</h1>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
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
              onOpen={() => setDetail(r)}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              onDelete={deleteRound}
            />
          ))
        )}
      </div>

      {detail && <HistoryDetail round={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function teamWinLabel(a: number, b: number) {
  return a > b ? 'A ↑' : b > a ? 'B ↑' : '=';
}
function teamWinColor(a: number, b: number) {
  return a > b ? 'var(--team-a)' : b > a ? 'var(--team-b)' : 'var(--gold)';
}

function RoundCard({
  r, onOpen, confirmDeleteId, setConfirmDeleteId, onDelete,
}: {
  r: HistoryRound;
  onOpen: () => void;
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
  onDelete: (id: number) => void;
}) {
  const ag = r.activeGames || {};
  const ta = (r.teamAssignments || {}) as Record<string, 'A' | 'B'>;

  const teamAName = PLAYERS.filter(p => ta[p.id] === 'A').map(p => p.name).join(' & ') || 'Team A';
  const teamBName = PLAYERS.filter(p => ta[p.id] === 'B').map(p => p.name).join(' & ') || 'Team B';

  const stbl = PLAYERS.map(p => ({ p, pts: roundStableford(r, p.id) }));
  const totA = stbl.filter(x => ta[x.p.id] === 'A').reduce((s, x) => s + x.pts, 0);
  const totB = stbl.filter(x => ta[x.p.id] === 'B').reduce((s, x) => s + x.pts, 0);

  const grossMap = Object.fromEntries(
    PLAYERS.map(p => [p.id, r.scores[p.id]?.reduce((s, v) => s + (v > 0 ? v : 0), 0) ?? 0])
  );
  const netMap = Object.fromEntries(
    PLAYERS.map(p => {
      const g = grossMap[p.id];
      if (!g) return [p.id, 0];
      const ph = getPlayingHandicap(p.id, r.handicaps, r.courseRating ?? 71, r.slopeRating ?? 113, r.pars);
      return [p.id, g - ph];
    })
  );

  const skinMap: Record<string, number> = {};
  if (ag.skins) {
    for (const s of calcSkins(PLAYERS, r.scores, r.pars, r.handicaps, r.indices)) {
      if (s.winner) skinMap[s.winner.id] = (skinMap[s.winner.id] || 0) + s.value;
    }
  }

  const wolfMap: Record<string, number> = {};
  if (ag.wolf && r.wolfOrder?.length) {
    for (const wh of calcWolf(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, r.wolfOrder, r.wolfHoles || [])) {
      for (const [pid, pts] of Object.entries(wh.pm)) {
        wolfMap[pid] = (wolfMap[pid] || 0) + pts;
      }
    }
  }

  const nassau = ag.nassau
    ? calcNassau(PLAYERS, r.scores, r.pars, r.handicaps, r.indices, ta)
    : null;

  const ctpCount: Record<string, number> = {};
  const ldCount: Record<string, number>  = {};
  for (let h = 0; h < 18; h++) {
    const cw = r.compWinners?.[h];
    if (cw?.ctp) ctpCount[cw.ctp] = (ctpCount[cw.ctp] || 0) + 1;
    if (cw?.ld)  ldCount[cw.ld]   = (ldCount[cw.ld]   || 0) + 1;
  }
  const hasCtp = ag.ctp  && Object.keys(ctpCount).length > 0;
  const hasLd  = ag.longDrive && Object.keys(ldCount).length > 0;

  const hasTeam = ag.teamMultiplier || ag.nassau;

  return (
    <div className="history-round" onClick={onOpen}>
      <div className="history-round-header">
        <div>
          <div className="history-round-date">{r.label}</div>
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
          <button
            className="history-delete-btn"
            onClick={e => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
          >🗑</button>
        )}
      </div>

      <table className="history-games-table">
        <thead>
          <tr>
            <th />
            {PLAYERS.map(p => <th key={p.id} style={{ color: p.color }}>{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Stableford</td>
            {stbl.map(({ p, pts }) => (
              <td key={p.id} style={{ color: 'var(--gold)', fontWeight: 700 }}>{pts}</td>
            ))}
          </tr>
          {ag.gross && (
            <tr>
              <td>Gross</td>
              {PLAYERS.map(p => <td key={p.id}>{grossMap[p.id] || '—'}</td>)}
            </tr>
          )}
          {ag.net && (
            <tr>
              <td>Net</td>
              {PLAYERS.map(p => <td key={p.id}>{netMap[p.id] || '—'}</td>)}
            </tr>
          )}
          {ag.skins && (
            <tr>
              <td>Skins</td>
              {PLAYERS.map(p => <td key={p.id}>{skinMap[p.id] || 0}</td>)}
            </tr>
          )}
          {ag.wolf && (
            <tr>
              <td>Wolf</td>
              {PLAYERS.map(p => <td key={p.id}>{wolfMap[p.id] || 0}</td>)}
            </tr>
          )}
          {hasCtp && (
            <tr>
              <td>📍 CTP</td>
              {PLAYERS.map(p => <td key={p.id}>{ctpCount[p.id] || 0}</td>)}
            </tr>
          )}
          {hasLd && (
            <tr>
              <td>💨 Long Drive</td>
              {PLAYERS.map(p => <td key={p.id}>{ldCount[p.id] || 0}</td>)}
            </tr>
          )}
        </tbody>
      </table>

      {hasTeam && (
        <table className="history-games-table" style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 4 }}>
          <thead>
            <tr>
              <th />
              <th style={{ color: 'var(--team-a)' }}>{teamAName}</th>
              <th style={{ color: 'var(--team-b)' }}>{teamBName}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ag.teamMultiplier && (
              <tr>
                <td>Team</td>
                <td>{totA}pts</td>
                <td>{totB}pts</td>
                <td style={{ color: teamWinColor(totA, totB), textAlign: 'right' }}>{teamWinLabel(totA, totB)}</td>
              </tr>
            )}
            {nassau && <>
              <tr>
                <td>Front 9</td>
                <td>{nassau.front.a}pts</td>
                <td>{nassau.front.b}pts</td>
                <td style={{ color: teamWinColor(nassau.front.a, nassau.front.b), textAlign: 'right' }}>{teamWinLabel(nassau.front.a, nassau.front.b)}</td>
              </tr>
              <tr>
                <td>Back 9</td>
                <td>{nassau.back.a}pts</td>
                <td>{nassau.back.b}pts</td>
                <td style={{ color: teamWinColor(nassau.back.a, nassau.back.b), textAlign: 'right' }}>{teamWinLabel(nassau.back.a, nassau.back.b)}</td>
              </tr>
              <tr>
                <td>Full 18</td>
                <td>{nassau.full.a}pts</td>
                <td>{nassau.full.b}pts</td>
                <td style={{ color: teamWinColor(nassau.full.a, nassau.full.b), textAlign: 'right' }}>{teamWinLabel(nassau.full.a, nassau.full.b)}</td>
              </tr>
            </>}
          </tbody>
        </table>
      )}

    </div>
  );
}

function HistoryDetail({ round: r, onClose }: { round: HistoryRound; onClose: () => void }) {
  const front = Array.from({ length: 9 }, (_, i) => i);
  const back  = Array.from({ length: 9 }, (_, i) => i + 9);
  const ta    = r.teamAssignments || {};
  const totA  = PLAYERS.filter(p => ta[p.id] === 'A').reduce((s, p) => s + roundStableford(r, p.id), 0);
  const totB  = PLAYERS.filter(p => ta[p.id] === 'B').reduce((s, p) => s + roundStableford(r, p.id), 0);
  const hdTeamAName = PLAYERS.filter(p => ta[p.id] === 'A').map(p => p.name).join(' & ') || 'Team A';
  const hdTeamBName = PLAYERS.filter(p => ta[p.id] === 'B').map(p => p.name).join(' & ') || 'Team B';
  const diff = totA - totB;

  function cell(pid: string, h: number) {
    const s = r.scores[pid]?.[h];
    if (!s) return { val: '—', color: 'rgba(245,240,232,0.15)' };
    const pts = stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices);
    const color = pts !== null && pts >= 4 ? 'var(--gold)' : pts !== null && pts >= 3 ? 'var(--green-bright)' : '';
    return { val: String(s), color };
  }

  function sectionPts(pid: string, holes: number[]) {
    return holes.reduce((sum, h) =>
      sum + (stablefordPoints(r.scores[pid]?.[h] ?? 0, r.pars[h], pid, h, r.handicaps, r.indices) ?? 0), 0);
  }

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
        {diff > 0 && (
          <div className="result-banner" style={{ background: 'rgba(78,186,122,0.1)', border: '1px solid rgba(78,186,122,0.25)' }}>
            <div className="result-label">Winner</div>
            <div className="result-text" style={{ color: 'var(--team-a)' }}>{hdTeamAName}</div>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 3 }}>{diff} pts ahead</div>
          </div>
        )}
        {diff < 0 && (
          <div className="result-banner" style={{ background: 'rgba(85,153,204,0.1)', border: '1px solid rgba(85,153,204,0.25)' }}>
            <div className="result-label">Winner</div>
            <div className="result-text" style={{ color: 'var(--team-b)' }}>{hdTeamBName}</div>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 3 }}>{Math.abs(diff)} pts ahead</div>
          </div>
        )}
        {diff === 0 && (
          <div className="result-banner" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="result-label">Result</div>
            <div className="result-text" style={{ color: 'var(--gold)' }}>All Square</div>
          </div>
        )}

        <div className="card">
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
                  {front.map(h => <td key={h}>{r.pars[h]}</td>)}
                  <td>{front.reduce((s, h) => s + r.pars[h], 0)}</td>
                  {back.map(h => <td key={h}>{r.pars[h]}</td>)}
                  <td>{back.reduce((s, h) => s + r.pars[h], 0)}</td>
                  <td>{r.pars.reduce((a, b) => a + b, 0)}</td>
                </tr>
                {PLAYERS.map(p => {
                  const c = cell.bind(null, p.id);
                  return (
                    <tr key={p.id}>
                      <td className="sc-name">
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: p.color, marginRight: 4, verticalAlign: 'middle' }} />
                        {p.name}
                      </td>
                      {front.map(h => { const x = c(h); return <td key={h} style={{ color: x.color }}>{x.val}</td>; })}
                      <td className="sc-total">{sectionPts(p.id, front)}</td>
                      {back.map(h => { const x = c(h); return <td key={h} style={{ color: x.color }}>{x.val}</td>; })}
                      <td className="sc-total">{sectionPts(p.id, back)}</td>
                      <td className="sc-total" style={{ fontSize: 11 }}>{roundStableford(r, p.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', textAlign: 'center', marginTop: 8 }}>
          {PLAYERS.map(p => `${p.name} HCP ${r.handicaps[p.id]}`).join(' · ')}
        </div>
      </div>
    </div>
  );
}
