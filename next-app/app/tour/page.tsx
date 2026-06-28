'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAYERS } from '../../store/gameStore';
import { fetchTourEvents, syncRoundsFromCloud } from '../../lib/db';
import type { HistoryRound } from '../../lib/db';
import { seasonLeaderboard } from '../../lib/tour';
import { EventResultsTable } from '../components/EventResultsTable';
import type { TourEvent, SeasonEntry } from '../../lib/types';

const CURRENT_SEASON = 2026;

function loadHistory(): HistoryRound[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('golf_history') || '[]'); } catch { return []; }
}

function playerById(pid: string) {
  return PLAYERS.find(p => p.id === pid);
}

function PlayerDot({ pid, size = 22 }: { pid: string; size?: number }) {
  const pl = playerById(pid);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: pl?.color ?? '#888',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, fontWeight: 700, color: '#0d2818', flexShrink: 0,
    }}>
      {pl?.name[0]}
    </div>
  );
}

const RANK_BADGE = ['🥇', '🥈', '🥉', '4️⃣'];
const MONTHS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function fmtDate(d: string) {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${MONTHS[m] ?? m} ${parseInt(day, 10)}`;
}

function fmtFormat(fmt: string) {
  if (fmt === 'multiplier') return 'Multiplier';
  if (fmt === 'worstBall') return 'Worst Ball';
  if (fmt === 'bestBall') return 'Best Ball';
  return fmt;
}

// ─── Leaderboard Card ────────────────────────────────────────────────────────

function LeaderboardCard({ entries }: { entries: SeasonEntry[] }) {
  const colStyle = (v: number | string, bold = false): React.CSSProperties => ({
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color: bold ? 'var(--gold)' : 'var(--cream)',
    fontWeight: bold ? 700 : 400,
    textAlign: 'right' as const,
    minWidth: 28,
  });

  return (
    <div className="card">
      <div className="card-title">🏅 2026 Season Standings</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 340 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
              <th style={{ textAlign: 'left', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingRight: 8 }}>#</th>
              <th style={{ textAlign: 'left', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6 }}>Player</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>Pts</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>Net</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>3+</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>Team</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>Bns</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>3P</th>
              <th style={{ textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', fontWeight: 500, paddingBottom: 6, paddingLeft: 8 }}>💩</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const pl = playerById(e.playerId);
              return (
                <tr key={e.playerId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ paddingTop: 8, paddingBottom: 8, paddingRight: 8, fontSize: 16 }}>{RANK_BADGE[i]}</td>
                  <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <PlayerDot pid={e.playerId} size={24} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: pl?.color }}>{pl?.name}</span>
                    </div>
                  </td>
                  <td style={{ ...colStyle(e.total, true), paddingLeft: 8, paddingTop: 8, paddingBottom: 8 }}>{e.total}</td>
                  <td style={{ ...colStyle(e.net), paddingLeft: 8 }}>{e.net}</td>
                  <td style={{ ...colStyle(e.threePlus), paddingLeft: 8 }}>{e.threePlus}</td>
                  <td style={{ ...colStyle(e.team), paddingLeft: 8 }}>{e.team}</td>
                  <td style={{ ...colStyle(e.behind), paddingLeft: 8, color: e.behind === 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.4)' }}>
                    {e.behind === 0 ? '—' : `-${e.behind}`}
                  </td>
                  <td style={{ ...colStyle(e.threePutts), paddingLeft: 8, color: e.threePutts > 5 ? '#e88' : 'rgba(245,240,232,0.5)' }}>{e.threePutts}</td>
                  <td style={{ ...colStyle(e.poops), paddingLeft: 8 }}>{e.poops > 0 ? e.poops : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <LegendChip>Net = net score bracket</LegendChip>
        <LegendChip>3+ = stableford 3+ pt holes</LegendChip>
        <LegendChip>Bns = bonus (CTP/LD)</LegendChip>
        <LegendChip>3P = 3-putts</LegendChip>
      </div>
    </div>
  );
}

function LegendChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', letterSpacing: 0.3 }}>{children}</span>
  );
}

// ─── Event Results Card ───────────────────────────────────────────────────────

function EventResultsCard({
  events,
  roundsByEventId,
}: {
  events: TourEvent[];
  roundsByEventId: Record<string, HistoryRound>;
}) {
  const [expanded, setExpanded] = useState<string | null>(events[events.length - 1]?.id ?? null);

  return (
    <div className="card">
      <div className="card-title">📅 2026 Events</div>
      {events.length === 0 && (
        <div className="empty-state">No events found.</div>
      )}
      {events.map(event => {
        const round = roundsByEventId[event.id];
        const isOpen = expanded === event.id;
        const month = fmtDate(event.date);
        const isWolf = !event.teamWinner && round?.activeGames?.wolf === true;

        return (
          <div key={event.id} style={{ marginBottom: 10 }}>
            <button
              onClick={() => setExpanded(isOpen ? null : event.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8,
                padding: '10px 12px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', minWidth: 60 }}>{month}</span>
              <span style={{ fontSize: 13, color: 'var(--cream)', flex: 1 }}>{event.courseName}</span>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: 0.4, padding: '2px 5px', borderRadius: 3,
                background: event.source === 'app' ? 'rgba(78,186,122,0.15)' : 'rgba(201,168,76,0.12)',
                color: event.source === 'app' ? 'var(--green-bright)' : 'rgba(201,168,76,0.7)',
                border: event.source === 'app' ? '1px solid rgba(78,186,122,0.3)' : '1px solid rgba(201,168,76,0.25)',
                flexShrink: 0,
              }}>
                {event.source === 'app' ? '📱 App' : '📊 Excel'}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div style={{ padding: '10px 4px 0' }}>
                <div style={{
                  display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10,
                  fontSize: 10, color: 'rgba(245,240,232,0.45)',
                }}>
                  <span>{isWolf ? 'Wolf' : fmtFormat(event.teamFormat)}</span>
                  <span>·</span>
                  <span>Rating {event.courseRating} / Slope {event.slopeRating}</span>
                  {event.ctpWinner && <><span>·</span><span>📍 CTP: {playerById(event.ctpWinner)?.name}</span></>}
                  {event.ldWinner && <><span>·</span><span>🏌️ LD: {playerById(event.ldWinner)?.name}</span></>}
                  {event.poopWinner && <><span>·</span><span>💩 {playerById(event.poopWinner)?.name}</span></>}
                </div>

                {round ? (
                  <EventResultsTable event={event} round={round} />
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.3)', padding: '8px 0' }}>
                    Round data not found — sync history to load scores.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TourPage() {
  const [events,    setEvents]    = useState<TourEvent[]>([]);
  const [rounds,    setRounds]    = useState<HistoryRound[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [cloudMsg,  setCloudMsg]  = useState('');

  useEffect(() => {
    const local = loadHistory();
    setRounds(local);
    loadData(local);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(localRounds: HistoryRound[]) {
    setLoading(true);
    const [evts, merged] = await Promise.all([
      fetchTourEvents(CURRENT_SEASON),
      syncRoundsFromCloud(localRounds),
    ]);
    setEvents(evts);
    if (merged) {
      localStorage.setItem('golf_history', JSON.stringify(merged.slice(0, 50)));
      setRounds(merged);
    }
    setLoading(false);
  }

  async function syncHandicap() {
    setCloudMsg('⏳ Syncing…');
    const local = loadHistory();
    const [evts, merged] = await Promise.all([
      fetchTourEvents(CURRENT_SEASON),
      syncRoundsFromCloud(local),
    ]);
    setEvents(evts);
    if (merged) {
      localStorage.setItem('golf_history', JSON.stringify(merged.slice(0, 50)));
      setRounds(merged);
    }
    setCloudMsg('✅ Synced');
    setTimeout(() => setCloudMsg(''), 2500);
  }

  const roundsByEventId: Record<string, HistoryRound> = {};
  for (const event of events) {
    if (event.roundId !== null) {
      const r = rounds.find(rr => rr.id === event.roundId);
      if (r) roundsByEventId[event.id] = r;
    }
  }

  const leaderboard = events.length ? seasonLeaderboard(events, roundsByEventId) : [];

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 0', maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/history" style={{ color: 'var(--gold)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>←</Link>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', margin: 0 }}>
            DE World Tour
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cloudMsg && (
            <span style={{
              fontSize: 11,
              color: cloudMsg.startsWith('✅') ? 'var(--green-bright)' : 'var(--gold)',
            }}>
              {cloudMsg}
            </span>
          )}
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '5px 10px', marginBottom: 0 }}
            onClick={syncHandicap}
          >
            ☁️ Sync
          </button>
        </div>
      </div>

      <div className="card-page-wrap">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,240,232,0.4)', fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <>
            {leaderboard.length > 0 && <LeaderboardCard entries={leaderboard} />}
            <EventResultsCard events={events} roundsByEventId={roundsByEventId} />
          </>
        )}
      </div>
    </>
  );
}
