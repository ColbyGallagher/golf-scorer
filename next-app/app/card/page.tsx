'use client';

import { useState } from 'react';
import { useGameStore, PLAYERS } from '../../store/gameStore';
import { stablefordPoints, strokesOnHole, getEffectivePlayingHandicaps } from '../../lib/scoring';
import type { Player, PlayerId } from '../../lib/types';
import GameNav from '../_components/GameNav';

type RowKey = 'gross' | 'net' | 'stbl' | 'threeP' | 'ld' | 'ctp';

const ROW_TOGGLES: { key: RowKey; label: string }[] = [
  { key: 'gross',  label: 'Gross' },
  { key: 'net',    label: 'Net' },
  { key: 'stbl',   label: 'Stbl' },
  { key: 'threeP', label: '3-Putt' },
  { key: 'ld',     label: 'Long Drive' },
  { key: 'ctp',    label: 'CTP' },
];

export default function CardPage() {
  const scores                 = useGameStore(s => s.scores);
  const threePutts             = useGameStore(s => s.threePutts);
  const compWinners            = useGameStore(s => s.compWinners);
  const pars                   = useGameStore(s => s.pars);
  const indices                = useGameStore(s => s.indices);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const activeGames            = useGameStore(s => s.activeGames);
  const teamAssignments        = useGameStore(s => s.teamAssignments);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);

  const [visible, setVisible] = useState<Record<RowKey, boolean>>({
    gross: true, net: true, stbl: true, threeP: false, ld: false, ctp: false,
  });
  const toggleRow = (k: RowKey) => setVisible(v => ({ ...v, [k]: !v[k] }));

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  const front = Array.from({ length: 9 }, (_, i) => i);
  const back  = Array.from({ length: 9 }, (_, i) => i + 9);
  const totalCols = 1 + front.length + 1 + back.length + 1; // Player + 9 + OUT + 9 + IN + TOT

  const cnt = Array.from({ length: 18 }, (_, h) =>
    PLAYERS.some(p => scores[p.id as PlayerId][h] > 0),
  ).filter(Boolean).length;

  // Per-player per-hole grid. Score metrics are null when the hole is unplayed;
  // tick metrics are plain booleans.
  function playerGrid(pid: PlayerId): PlayerGrid {
    const gross: (number | null)[] = [];
    const net:   (number | null)[] = [];
    const stbl:  (number | null)[] = [];
    const threeP: boolean[] = [];
    const ld:     boolean[] = [];
    const ctp:    boolean[] = [];
    for (let h = 0; h < 18; h++) {
      const s = scores[pid][h];
      if (!s) { gross.push(null); net.push(null); stbl.push(null); }
      else {
        gross.push(s);
        net.push(s - strokesOnHole(pid, h, playingHandicaps, indices));
        stbl.push(stablefordPoints(s, pars[h], pid, h, playingHandicaps, indices) ?? 0);
      }
      threeP.push(!!threePutts[pid]?.[h]);
      ld.push(compWinners[h]?.ld === pid);
      ctp.push(compWinners[h]?.ctp === pid);
    }
    return { gross, net, stbl, threeP, ld, ctp };
  }

  // ── Team grouping ──────────────────────────────────────────────────────────
  const missingIndices = indices.length === 18 && indices.every(i => i === 0);
  const teamAPlayers = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === 'A');
  const teamBPlayers = PLAYERS.filter(p => teamAssignments[p.id as PlayerId] === 'B');
  const hasTeams = teamAPlayers.length > 0 && teamBPlayers.length > 0;

  type Fmt = 'multiplier' | 'bestBall' | 'worstBall' | 'aggregate' | 'stableford';
  const teamFmt: Fmt =
      activeGames.teamMultiplier ? 'multiplier'
    : activeGames.bestBall      ? 'bestBall'
    : activeGames.worstBall     ? 'worstBall'
    : activeGames.aggregate     ? 'aggregate'
    : 'stableford';
  const FMT_LABEL: Record<Fmt, string> = {
    multiplier: 'Multiplier', bestBall: 'Best Ball', worstBall: 'Worst Ball',
    aggregate: 'Aggregate', stableford: 'Stableford',
  };

  function teamHoleValue(teamPs: typeof PLAYERS, h: number): number | null {
    const played = teamPs.filter(p => scores[p.id as PlayerId][h] > 0);
    if (!played.length) return null;
    const sf = (p: typeof PLAYERS[number]) =>
      stablefordPoints(scores[p.id as PlayerId][h], pars[h], p.id as PlayerId, h, playingHandicaps, indices) ?? 0;
    switch (teamFmt) {
      case 'multiplier': return teamPs.reduce((acc, p) => acc * sf(p), 1);
      case 'bestBall':   return missingIndices
        ? Math.min(...played.map(p => scores[p.id as PlayerId][h]))
        : Math.max(...teamPs.map(sf));
      case 'worstBall':  return Math.min(...played.map(sf));
      default:           return played.reduce((s, p) => s + sf(p), 0); // aggregate + stableford
    }
  }
  function teamSectionValue(teamPs: typeof PLAYERS, holes: number[]) {
    return holes.reduce((s, h) => s + (teamHoleValue(teamPs, h) ?? 0), 0);
  }

  const teamGroups = hasTeams
    ? [
        { team: 'A' as const, players: teamAPlayers },
        { team: 'B' as const, players: teamBPlayers },
      ]
    : [{ team: null, players: PLAYERS }];

  return (
    <>
      <GameNav />
      <div className="card-page-wrap">
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${cnt / 18 * 100}%` }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 4, marginBottom: 10 }}>
          {cnt} / 18 holes played{hasTeams && ` · ${FMT_LABEL[teamFmt]} team scoring`}
        </div>

        <div className="card-toggle-bar">
          {ROW_TOGGLES.map(t => (
            <button
              key={t.key}
              onClick={() => toggleRow(t.key)}
              className={`card-toggle${visible[t.key] ? ' on' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

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
                {front.map(h => <td key={h}>{pars[h]}</td>)}
                <td>{front.reduce((s, h) => s + pars[h], 0)}</td>
                {back.map(h => <td key={h}>{pars[h]}</td>)}
                <td>{back.reduce((s, h) => s + pars[h], 0)}</td>
                <td>{pars.reduce((a, b) => a + b, 0)}</td>
              </tr>
              <tr className="sc-idx-row">
                <td className="sc-name" style={{ color: 'rgba(245,240,232,0.25)' }}>SI</td>
                {front.map(h => <td key={h}>{indices[h]}</td>)}
                <td>–</td>
                {back.map(h => <td key={h}>{indices[h]}</td>)}
                <td>–</td>
                <td>–</td>
              </tr>

              {teamGroups.map(({ team, players }, gi) => (
                <TeamBlock
                  key={team ?? 'all'}
                  team={team}
                  players={players}
                  firstGap={gi > 0}
                  front={front}
                  back={back}
                  totalCols={totalCols}
                  visible={visible}
                  grid={playerGrid}
                  teamHoleValue={h => teamHoleValue(players, h)}
                  teamSectionValue={holes => teamSectionValue(players, holes)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Row components ───────────────────────────────────────────────────────────

interface PlayerGrid {
  gross: (number | null)[];
  net: (number | null)[];
  stbl: (number | null)[];
  threeP: boolean[];
  ld: boolean[];
  ctp: boolean[];
}

const sumHoles = (vals: (number | null)[], holes: number[]) =>
  holes.reduce((t, h) => t + (vals[h] ?? 0), 0);

const countHoles = (vals: boolean[], holes: number[]) =>
  holes.reduce((t, h) => t + (vals[h] ? 1 : 0), 0);

const fmt = (v: number | null) => (v === null ? '—' : String(v));

// Colour a gross / stableford cell off its stableford points.
const ptsColor = (pts: number | null) =>
  pts !== null && pts >= 4 ? 'var(--gold)'
  : pts !== null && pts >= 3 ? 'var(--green-bright)'
  : '';

function MetricRow({ label, values, ptsArr, front, back, dim }: {
  label: string;
  values: (number | null)[];
  ptsArr: (number | null)[] | null;   // null → plain colour (net row)
  front: number[];
  back: number[];
  dim?: boolean;
}) {
  const cellColor = (h: number) =>
    dim ? 'rgba(245,240,232,0.5)' : ptsArr ? ptsColor(ptsArr[h]) : '';
  return (
    <tr>
      <td className="sc-name sc-metric-name"><span className="sc-metric-label">{label}</span></td>
      {front.map(h => <td key={h} style={{ color: cellColor(h) }}>{fmt(values[h])}</td>)}
      <td className="sc-total">{sumHoles(values, front)}</td>
      {back.map(h => <td key={h} style={{ color: cellColor(h) }}>{fmt(values[h])}</td>)}
      <td className="sc-total">{sumHoles(values, back)}</td>
      <td className="sc-total" style={{ fontSize: 11 }}>{sumHoles(values, [...front, ...back])}</td>
    </tr>
  );
}

function TickRow({ label, values, front, back }: {
  label: string;
  values: boolean[];
  front: number[];
  back: number[];
}) {
  const mark = (v: boolean) =>
    v ? <span style={{ color: 'var(--green-bright)' }}>✓</span>
      : <span style={{ color: 'rgba(245,240,232,0.15)' }}>–</span>;
  return (
    <tr>
      <td className="sc-name sc-metric-name"><span className="sc-metric-label">{label}</span></td>
      {front.map(h => <td key={h}>{mark(values[h])}</td>)}
      <td className="sc-total">{countHoles(values, front)}</td>
      {back.map(h => <td key={h}>{mark(values[h])}</td>)}
      <td className="sc-total">{countHoles(values, back)}</td>
      <td className="sc-total" style={{ fontSize: 11 }}>{countHoles(values, [...front, ...back])}</td>
    </tr>
  );
}

function PlayerBlock({ player, grid, front, back, totalCols, visible, topGap }: {
  player: Player;
  grid: PlayerGrid;
  front: number[];
  back: number[];
  totalCols: number;
  visible: Record<RowKey, boolean>;
  topGap: boolean;
}) {
  return (
    <>
      <tr className={`sc-player-name${topGap ? ' sc-team-gap' : ''}`}>
        <td className="sc-name" colSpan={totalCols}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: player.color, marginRight: 6, verticalAlign: 'middle' }} />
          {player.name}
        </td>
      </tr>
      {visible.gross  && <MetricRow label="Gross" values={grid.gross} ptsArr={grid.stbl} front={front} back={back} />}
      {visible.net    && <MetricRow label="Net"   values={grid.net}   ptsArr={null}      front={front} back={back} dim />}
      {visible.stbl   && <MetricRow label="Stbl"  values={grid.stbl}  ptsArr={grid.stbl} front={front} back={back} />}
      {visible.threeP && <TickRow   label="3-Putt"      values={grid.threeP} front={front} back={back} />}
      {visible.ld     && <TickRow   label="Long Drive"  values={grid.ld}     front={front} back={back} />}
      {visible.ctp    && <TickRow   label="CTP"         values={grid.ctp}    front={front} back={back} />}
    </>
  );
}

function TeamBlock({
  team, players, firstGap, front, back, totalCols, visible, grid, teamHoleValue, teamSectionValue,
}: {
  team: 'A' | 'B' | null;
  players: Player[];
  firstGap: boolean;
  front: number[];
  back: number[];
  totalCols: number;
  visible: Record<RowKey, boolean>;
  grid: (pid: PlayerId) => PlayerGrid;
  teamHoleValue: (h: number) => number | null;
  teamSectionValue: (holes: number[]) => number;
}) {
  return (
    <>
      {players.map((p, i) => (
        <PlayerBlock
          key={p.id}
          player={p}
          grid={grid(p.id as PlayerId)}
          front={front}
          back={back}
          totalCols={totalCols}
          visible={visible}
          topGap={firstGap && i === 0}
        />
      ))}
      {team && (
        <tr className={`sc-team-row sc-team-${team === 'A' ? 'a' : 'b'}`}>
          <td className="sc-name">Team {team}</td>
          {front.map(h => <td key={h}>{fmt(teamHoleValue(h))}</td>)}
          <td className="sc-total">{teamSectionValue(front)}</td>
          {back.map(h => <td key={h}>{fmt(teamHoleValue(h))}</td>)}
          <td className="sc-total">{teamSectionValue(back)}</td>
          <td className="sc-total" style={{ fontSize: 11 }}>{teamSectionValue([...front, ...back])}</td>
        </tr>
      )}
    </>
  );
}
