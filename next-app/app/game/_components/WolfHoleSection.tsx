'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';
import { stablefordPoints, getEffectivePlayingHandicaps } from '../../../lib/scoring';
import type { PlayerId, WolfMode } from '../../../lib/types';

interface Props {
  hole: number;
}

const MODE_BTN_BASE: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 20, border: '1px solid',
  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
};

function modeStyle(active: boolean): React.CSSProperties {
  return active
    ? { ...MODE_BTN_BASE, background: 'rgba(78,186,122,0.18)', borderColor: 'var(--green-bright)', color: 'var(--green-bright)' }
    : { ...MODE_BTN_BASE, background: 'rgba(245,240,232,0.04)', borderColor: 'rgba(245,240,232,0.12)', color: 'rgba(245,240,232,0.45)' };
}

export default function WolfHoleSection({ hole }: Props) {
  const activeGames            = useGameStore(s => s.activeGames);
  const wolfOrder              = useGameStore(s => s.wolfOrder);
  const wolfHoles              = useGameStore(s => s.wolfHoles);
  const scores                 = useGameStore(s => s.scores);
  const pars                   = useGameStore(s => s.pars);
  const handicaps              = useGameStore(s => s.handicaps);
  const dailyHandicapOverrides = useGameStore(s => s.dailyHandicapOverrides);
  const courseRating           = useGameStore(s => s.courseRating);
  const slopeRating            = useGameStore(s => s.slopeRating);
  const indices                = useGameStore(s => s.indices);
  const setWolfHole            = useGameStore(s => s.setWolfHole);

  const playingHandicaps = getEffectivePlayingHandicaps(handicaps, dailyHandicapOverrides, courseRating, slopeRating, pars);

  if (!activeGames.wolf) return null;

  const wolfId = wolfOrder.length ? wolfOrder[hole % wolfOrder.length] : null;
  const wolf   = PLAYERS.find(p => p.id === wolfId);
  if (!wolf || !wolfId) return null;

  const wh   = wolfHoles[hole];
  const mode = wh.mode;
  const par  = pars[hole];

  function toggleMode(m: WolfMode) {
    const next = mode === m ? null : m;
    setWolfHole(hole, { mode: next, partnerId: next !== 'partner' ? null : wh.partnerId });
  }

  function togglePartner(pid: PlayerId) {
    setWolfHole(hole, { partnerId: wh.partnerId === pid ? null : pid });
  }

  // Live result preview when scores are entered
  let resultEl: React.ReactNode = null;
  if (mode && PLAYERS.some(p => scores[p.id][hole] > 0)) {
    const wolfPts = stablefordPoints(scores[wolfId][hole], par, wolfId, hole, playingHandicaps, indices) ?? 0;
    const others  = PLAYERS.filter(p => p.id !== wolfId);

    if (mode === 'blind' || mode === 'alone') {
      const maxOther = Math.max(...others.map(p => stablefordPoints(scores[p.id][hole], par, p.id, hole, playingHandicaps, indices) ?? 0));
      const winPts = mode === 'blind' ? 8 : 4;
      if (wolfPts > maxOther)
        resultEl = <div style={{ marginTop: 9, fontSize: 11, fontWeight: 600, color: 'var(--green-bright)' }}>✅ {wolf.name} wins · +{winPts} pts</div>;
      else if (wolfPts < maxOther)
        resultEl = <div style={{ marginTop: 9, fontSize: 11, color: 'rgba(245,240,232,0.5)' }}>Others win · +2 pts each</div>;
      else
        resultEl = <div style={{ marginTop: 9, fontSize: 11, color: 'var(--gold)' }}>Draw · 0 pts</div>;
    } else if (mode === 'partner' && wh.partnerId) {
      const partnerPts = stablefordPoints(scores[wh.partnerId][hole], par, wh.partnerId, hole, playingHandicaps, indices) ?? 0;
      const otherTwo   = others.filter(p => p.id !== wh.partnerId);
      const wolfTeam   = Math.max(wolfPts, partnerPts);
      const otherTeam  = Math.max(...otherTwo.map(p => stablefordPoints(scores[p.id][hole], par, p.id, hole, playingHandicaps, indices) ?? 0));
      const partner    = PLAYERS.find(p => p.id === wh.partnerId);
      if (wolfTeam > otherTeam)
        resultEl = <div style={{ marginTop: 9, fontSize: 11, fontWeight: 600, color: 'var(--green-bright)' }}>✅ {wolf.name} & {partner?.name} win · +2 each</div>;
      else if (wolfTeam < otherTeam)
        resultEl = <div style={{ marginTop: 9, fontSize: 11, color: 'rgba(245,240,232,0.5)' }}>Others win · +3 pts each</div>;
      else
        resultEl = <div style={{ marginTop: 9, fontSize: 11, color: 'var(--gold)' }}>Draw · 0 pts</div>;
    }
  }

  return (
    <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 11, padding: '11px 13px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🐺</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: wolf.color }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{wolf.name}</span>
        <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>is Wolf</span>
        {hole >= 16 && (
          <span style={{ fontSize: 9, background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 8, marginLeft: 'auto' }}>
            Flip!
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([['blind', '🎯 Blind (8)'], ['alone', '🚶 Alone (4)'], ['partner', '🤝 Partner (2)']] as [WolfMode, string][]).map(([m, label]) => (
          <button key={m} style={modeStyle(mode === m)} onClick={() => toggleMode(m)}>{label}</button>
        ))}
      </div>

      {mode === 'partner' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {PLAYERS.filter(p => p.id !== wolfId).map(p => (
            <button key={p.id} style={modeStyle(wh.partnerId === p.id)} onClick={() => togglePartner(p.id as PlayerId)}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: p.color, marginRight: 4, verticalAlign: 'middle' }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {resultEl}
    </div>
  );
}
