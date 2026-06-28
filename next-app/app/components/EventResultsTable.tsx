'use client';

import React from 'react';
import { PLAYERS } from '../../store/gameStore';
import { eventPoints } from '../../lib/tour';
import { teamTotals, calcBestBall, stablefordPoints, calcWolf } from '../../lib/scoring';
import type { PlayerId, TourEvent } from '../../lib/types';
import type { HistoryRound } from '../../lib/db';

function playerById(pid: string) {
  return PLAYERS.find(p => p.id === pid);
}

function PlayerDot({ pid, size = 18 }: { pid: string; size?: number }) {
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

function fmtFormat(fmt: string) {
  if (fmt === 'multiplier') return 'Multiplier';
  if (fmt === 'worstBall') return 'Worst Ball';
  if (fmt === 'bestBall') return 'Best Ball';
  return fmt;
}

function calcTeamScores(event: TourEvent, round: HistoryRound): { A: number; B: number } {
  const hcps = event.roundHandicaps as Record<string, number>;
  const ta: Record<string, 'A' | 'B'> = {
    ...Object.fromEntries(event.teamA.map(id => [id, 'A' as const])),
    ...Object.fromEntries(event.teamB.map(id => [id, 'B' as const])),
  };
  if (event.teamFormat === 'multiplier') {
    const t = teamTotals(PLAYERS, round.scores, round.pars, hcps, round.indices, ta);
    return { A: t.totA, B: t.totB };
  }
  if (event.teamFormat === 'bestBall') {
    const t = calcBestBall(PLAYERS, round.scores, round.pars, hcps, round.indices, ta);
    return { A: t.totA, B: t.totB };
  }
  // worstBall — min stableford per team per hole
  let totA = 0, totB = 0;
  for (let h = 0; h < 18; h++) {
    for (const team of ['A', 'B'] as const) {
      const pids = team === 'A' ? event.teamA : event.teamB;
      const pts = pids.map(pid =>
        stablefordPoints(round.scores[pid]?.[h] ?? 0, round.pars[h], pid, h, hcps, round.indices) ?? 0,
      );
      const worst = Math.min(...pts);
      if (team === 'A') totA += worst; else totB += worst;
    }
  }
  return { A: totA, B: totB };
}

function playerGross(round: HistoryRound, pid: string): number {
  return (round.scores[pid] ?? []).reduce((s, v) => s + (v || 0), 0);
}

function playerStbl(round: HistoryRound, event: TourEvent, pid: string): number {
  const hcps = event.roundHandicaps as Record<string, number>;
  return (round.scores[pid] ?? []).reduce((sum, strokes, h) =>
    sum + (stablefordPoints(strokes, round.pars[h], pid, h, hcps, round.indices) ?? 0), 0);
}

// Shared Scoring/Points table for a tour event linked to a round.
// Used by both the Tour page and the History page so the two render identically.
export function EventResultsTable({ event, round }: { event: TourEvent; round: HistoryRound }) {
  const pts = eventPoints(round, event);
  const isWolf = !event.teamWinner && round.activeGames?.wolf === true;

  const teamScore = calcTeamScores(event, round);
  const teamAPlayers = PLAYERS.filter(p => event.teamA.includes(p.id as PlayerId));
  const teamBPlayers = PLAYERS.filter(p => event.teamB.includes(p.id as PlayerId));
  const thR: React.CSSProperties = { textAlign: 'right', fontSize: 10, color: 'rgba(245,240,232,0.35)', paddingBottom: 5, fontWeight: 500, paddingLeft: 6 };
  const mono: React.CSSProperties = { textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, paddingLeft: 6 };
  const dividerCell: React.CSSProperties = { borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 };
  const preDivider: React.CSSProperties = { paddingRight: 8 };
  const wolfResults = isWolf
    ? calcWolf(PLAYERS, round.scores, round.pars, event.roundHandicaps as Record<string, number>, round.indices, round.wolfOrder, round.wolfHoles, round.wolfOverrides)
    : null;
  const wolfTotals: Record<string, number> = {};
  if (wolfResults) {
    for (const hr of wolfResults) Object.entries(hr.pm).forEach(([pid, v]) => { wolfTotals[pid] = (wolfTotals[pid] ?? 0) + v; });
  }

  // scoringCols = Player + Gross + Net + Stbl + [Wolf] + 3P
  const scoringCols = isWolf ? 6 : 5;
  // pointsCols = Pts + Team + 3+ + LD + CTP + Total
  const pointsCols = 6;
  const totalCols = scoringCols + pointsCols;

  const renderPlayerRow = (pl: typeof PLAYERS[0]) => {
    const p = pts[pl.id as PlayerId];
    const gross = playerGross(round, pl.id);
    const net = gross > 0 ? gross - (event.roundHandicaps[pl.id as PlayerId] ?? 0) : 0;
    const stbl = playerStbl(round, event, pl.id);
    const threePutts = event.threePuttCounts?.[pl.id] ?? 0;
    const isLD = event.ldWinner === pl.id;
    const isCTP = event.ctpWinner === pl.id;
    return (
      <tr key={pl.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* — Scoring — */}
        <td style={{ paddingTop: 7, paddingBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PlayerDot pid={pl.id} size={18} />
            <span style={{ fontSize: 12, color: pl.color }}>{pl.name}</span>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>{event.roundHandicaps[pl.id as PlayerId] ?? 0}</span>
          </div>
        </td>
        <td style={mono}>{gross > 0 ? gross : '—'}</td>
        <td style={mono}>{net > 0 ? net : '—'}</td>
        <td style={mono}>{gross > 0 ? stbl : '—'}</td>
        {isWolf && <td style={{ ...mono, color: 'var(--cream)' }}>{wolfTotals[pl.id] ?? 0}</td>}
        <td style={{ ...mono, ...preDivider, color: threePutts > 0 ? '#e88' : 'rgba(245,240,232,0.3)' }}>{threePutts > 0 ? threePutts : '—'}</td>
        {/* — Points — */}
        <td style={{ ...mono, ...dividerCell, color: 'var(--cream)' }}>{p.net > 0 ? p.net : '—'}</td>
        <td style={{ ...mono, color: p.team > 0 ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{p.team > 0 ? p.team : '—'}</td>
        <td style={{ ...mono, color: p.threePlus > 0 ? 'var(--cream)' : 'rgba(245,240,232,0.3)' }}>{p.threePlus > 0 ? p.threePlus : '—'}</td>
        <td style={{ ...mono, color: isLD ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{isLD ? p.par5 : '—'}</td>
        <td style={{ ...mono, color: isCTP ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)' }}>{isCTP ? p.par3 : '—'}</td>
        <td style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{p.total}</td>
      </tr>
    );
  };

  const renderTeamHeader = (team: 'A' | 'B', score: number) => {
    const isWinner = event.teamWinner === team;
    const players = team === 'A' ? teamAPlayers : teamBPlayers;
    return (
      <tr key={`team-${team}`} style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <td colSpan={totalCols} style={{ paddingTop: 5, paddingBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {players.map(p => <PlayerDot key={p.id} pid={p.id} size={14} />)}
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{fmtFormat(event.teamFormat)}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: isWinner ? 'var(--green-bright)' : 'rgba(245,240,232,0.5)' }}>{score}</span>
            {isWinner && <span style={{ fontSize: 10, color: 'var(--green-bright)', marginLeft: 2 }}>✓ Win</span>}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead>
          {/* Section labels */}
          <tr>
            <th colSpan={scoringCols} style={{ textAlign: 'left', fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', paddingBottom: 3 }}>Scoring</th>
            <th colSpan={pointsCols} style={{ textAlign: 'left', fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', paddingBottom: 3, paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>Points</th>
          </tr>
          {/* Column headers */}
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
            PLAYERS.map(pl => renderPlayerRow(pl))
          ) : (
            <>
              {renderTeamHeader('A', teamScore.A)}
              {teamAPlayers.map(pl => renderPlayerRow(pl))}
              {renderTeamHeader('B', teamScore.B)}
              {teamBPlayers.map(pl => renderPlayerRow(pl))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
