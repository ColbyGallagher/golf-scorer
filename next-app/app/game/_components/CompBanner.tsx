'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';
import type { PlayerId } from '../../../lib/types';

interface Props {
  hole: number;
}

export default function CompBanner({ hole }: Props) {
  const pars         = useGameStore(s => s.pars);
  const activeGames  = useGameStore(s => s.activeGames);
  const compWinners  = useGameStore(s => s.compWinners);
  const setCompWinner = useGameStore(s => s.setCompWinner);

  const par = pars[hole];
  if (par === 3 && !activeGames.ctp) return null;
  if (par === 5 && !activeGames.longDrive) return null;
  if (par !== 3 && par !== 5) return null;

  const isCtp = par === 3;
  const field  = isCtp ? 'ctp' : 'ld';
  const label  = isCtp ? '📍 Closest to the Pin' : '💨 Long Drive';
  const cls    = isCtp ? 'comp-banner ctp-banner' : 'comp-banner ld-banner';
  const current = compWinners[hole]?.[field] ?? '';

  return (
    <div className={cls}>
      {label}
      <select
        className="comp-winner-select"
        value={current}
        onChange={e => setCompWinner(hole, { [field]: e.target.value as PlayerId | '' })}
      >
        <option value="">-- Winner --</option>
        {PLAYERS.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
        <option value="none">No Result</option>
      </select>
    </div>
  );
}
