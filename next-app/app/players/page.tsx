'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import { stablefordPoints } from '../../lib/scoring';
import type { HistoryRound } from '../../lib/db';
import type { PlayerId } from '../../lib/types';

function loadHistory(): HistoryRound[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('golf_history') || '[]'); } catch { return []; }
}

function formatDate(d: string) {
  const dt = new Date(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function roundStableford(r: HistoryRound, pid: string): number {
  return r.scores[pid]?.reduce((sum, s, h) =>
    sum + (stablefordPoints(s, r.pars[h], pid, h, r.handicaps, r.indices) ?? 0), 0) ?? 0;
}

function roundGross(r: HistoryRound, pid: string): number {
  return r.scores[pid]?.reduce((sum, s) => sum + (s > 0 ? s : 0), 0) ?? 0;
}

function playerRounds(rounds: HistoryRound[], pid: string): HistoryRound[] {
  return rounds.filter(r => r.scores[pid]?.some(s => s > 0));
}

interface PlayerStats {
  roundsPlayed: number;
  avgPts: number | null;
  bestPts: number | null;
  avgGross: number | null;
  bestGross: number | null;
  totalThreePutts: number;
  wins: number;
}

function computeStats(rounds: HistoryRound[], pid: string): PlayerStats {
  const played = playerRounds(rounds, pid);
  if (!played.length) {
    return { roundsPlayed: 0, avgPts: null, bestPts: null, avgGross: null, bestGross: null, totalThreePutts: 0, wins: 0 };
  }
  const ptsList  = played.map(r => roundStableford(r, pid));
  const grossList = played.map(r => roundGross(r, pid)).filter(g => g > 0);
  const totalThreePutts = played.reduce((sum, r) => {
    const tp = r.threePutts?.[pid];
    return sum + (Array.isArray(tp) ? tp.filter(Boolean).length : 0);
  }, 0);
  const wins = played.filter(r => {
    const ta = r.teamAssignments || {};
    const myTeam = ta[pid];
    if (!myTeam) return false;
    const totA = PLAYERS.filter(p => ta[p.id] === 'A').reduce((s, p) => s + roundStableford(r, p.id), 0);
    const totB = PLAYERS.filter(p => ta[p.id] === 'B').reduce((s, p) => s + roundStableford(r, p.id), 0);
    return myTeam === 'A' ? totA > totB : totB > totA;
  }).length;
  return {
    roundsPlayed: played.length,
    avgPts: ptsList.reduce((a, b) => a + b, 0) / ptsList.length,
    bestPts: Math.max(...ptsList),
    avgGross: grossList.length ? grossList.reduce((a, b) => a + b, 0) / grossList.length : null,
    bestGross: grossList.length ? Math.min(...grossList) : null,
    totalThreePutts,
    wins,
  };
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '7px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function PlayerCard({ pid, name, color, handicap, stats, editing, onChangeHandicap, onClick }: {
  pid: string; name: string; color: string; handicap: number;
  stats: PlayerStats; editing: boolean;
  onChangeHandicap: (v: number) => void;
  onClick: () => void;
}) {
  return (
    <div className="card" onClick={!editing ? onClick : undefined} style={{ cursor: editing ? 'default' : 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: stats.roundsPlayed > 0 ? 10 : 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#0d2818',
        }}>
          {name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
          {!editing && <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>HCP {handicap}</div>}
        </div>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>HCP</span>
            <input
              className="hcp-input"
              type="number"
              step="0.1"
              min={0}
              max={54}
              inputMode="decimal"
              value={handicap}
              onChange={e => onChangeHandicap(parseFloat(e.target.value) || 0)}
            />
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'right', marginRight: 4 }}>
              {stats.roundsPlayed > 0 ? (
                <>
                  <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>{stats.roundsPlayed} round{stats.roundsPlayed !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                    {stats.wins}W · {stats.roundsPlayed - stats.wins}L
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>No rounds</div>
              )}
            </div>
            <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: 15 }}>›</span>
          </>
        )}
      </div>

      {stats.roundsPlayed > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <StatBox label="Avg Pts" value={stats.avgPts !== null ? stats.avgPts.toFixed(1) : '—'} />
          <StatBox label="Best" value={stats.bestPts !== null ? `${stats.bestPts}` : '—'} />
          <StatBox label="Avg Gross" value={stats.avgGross !== null ? stats.avgGross.toFixed(1) : '—'} />
          <StatBox label="3-Putts" value={String(stats.totalThreePutts)} />
        </div>
      )}
    </div>
  );
}

function PlayerDetail({ pid, name, color, handicap, rounds, onClose }: {
  pid: string; name: string; color: string; handicap: number;
  rounds: HistoryRound[]; onClose: () => void;
}) {
  const played = playerRounds(rounds, pid);
  const stats  = computeStats(rounds, pid);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--green-deep)', overflowY: 'auto', zIndex: 100 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 14px 40px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--cream)', fontSize: 18, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>←</button>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0d2818' }}>
            {name[0]}
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: 'var(--gold)' }}>{name}</div>
            <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', letterSpacing: 1, textTransform: 'uppercase' }}>Handicap {handicap}</div>
          </div>
        </div>

        {stats.roundsPlayed > 0 && (
          <div className="card">
            <div className="card-title">📊 Career Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {([
                { label: 'Rounds', value: String(stats.roundsPlayed) },
                { label: 'Wins', value: `${stats.wins}/${stats.roundsPlayed}` },
                { label: '3-Putts', value: String(stats.totalThreePutts) },
              ] as const).map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <StatBox label="Avg Pts" value={stats.avgPts !== null ? stats.avgPts.toFixed(1) : '—'} />
              <StatBox label="Best Pts" value={stats.bestPts !== null ? String(stats.bestPts) : '—'} />
              <StatBox label="Avg Gross" value={stats.avgGross !== null ? stats.avgGross.toFixed(1) : '—'} />
              <StatBox label="Best Gross" value={stats.bestGross !== null ? String(stats.bestGross) : '—'} />
            </div>
          </div>
        )}

        <div className="card-title">🏌️ Round History</div>

        {played.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>No saved rounds yet.</div>
        ) : (
          played.map(r => {
            const pts   = roundStableford(r, pid);
            const gross = roundGross(r, pid);
            const ta    = r.teamAssignments || {};
            const myTeam = ta[pid];
            const totA  = PLAYERS.filter(p => ta[p.id] === 'A').reduce((s, p) => s + roundStableford(r, p.id), 0);
            const totB  = PLAYERS.filter(p => ta[p.id] === 'B').reduce((s, p) => s + roundStableford(r, p.id), 0);
            const won   = myTeam === 'A' ? totA > totB : myTeam === 'B' ? totB > totA : null;
            const tp    = Array.isArray(r.threePutts?.[pid]) ? r.threePutts[pid].filter(Boolean).length : 0;

            return (
              <div key={r.id} style={{
                background: 'linear-gradient(145deg, rgba(45,122,79,0.12), rgba(13,40,24,0.5))',
                border: '1px solid rgba(201,168,76,0.1)',
                borderRadius: 12,
                padding: '11px 13px',
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>
                      {formatDate(r.date)} · {r.holesPlayed} holes · HCP {r.handicaps[pid] ?? '?'}
                    </div>
                  </div>
                  {won !== null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: won ? 'rgba(78,186,122,0.15)' : 'rgba(224,85,85,0.12)',
                      color: won ? 'var(--green-bright)' : 'var(--red)',
                      border: `1px solid ${won ? 'rgba(78,186,122,0.3)' : 'rgba(224,85,85,0.25)'}`,
                    }}>
                      {won ? 'W' : 'L'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>{pts}</div>
                    <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stableford</div>
                  </div>
                  {gross > 0 && (
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{gross}</div>
                      <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gross</div>
                    </div>
                  )}
                  {tp > 0 && (
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--red)' }}>{tp}</div>
                      <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>3-Putts</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const [rounds,   setRounds]   = useState<HistoryRound[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing,  setEditing]  = useState(false);
  const handicaps   = useGameStore(s => s.handicaps);
  const setHandicap = useGameStore(s => s.setHandicap);

  useEffect(() => { setRounds(loadHistory()); }, []);

  const selectedPlayer = selected ? PLAYERS.find(p => p.id === selected) : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0', maxWidth: 480, margin: '0 auto' }}>
        <Link href="/setup" style={{ color: 'var(--gold)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', margin: 0, flex: 1 }}>Players</h1>
        <button
          onClick={() => setEditing(e => !e)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
            background: editing ? 'rgba(78,186,122,0.15)' : 'rgba(201,168,76,0.12)',
            border: `1px solid ${editing ? 'rgba(78,186,122,0.4)' : 'rgba(201,168,76,0.3)'}`,
            color: editing ? 'var(--green-bright)' : 'var(--gold)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {editing ? 'Done' : 'Edit Handicaps'}
        </button>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
        {PLAYERS.map(p => (
          <PlayerCard
            key={p.id}
            pid={p.id}
            name={p.name}
            color={p.color}
            handicap={handicaps[p.id as PlayerId]}
            stats={computeStats(rounds, p.id)}
            editing={editing}
            onChangeHandicap={v => setHandicap(p.id as PlayerId, v)}
            onClick={() => setSelected(p.id)}
          />
        ))}
      </div>

      {selectedPlayer && (
        <PlayerDetail
          pid={selectedPlayer.id}
          name={selectedPlayer.name}
          color={selectedPlayer.color}
          handicap={handicaps[selectedPlayer.id as PlayerId]}
          rounds={rounds}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
