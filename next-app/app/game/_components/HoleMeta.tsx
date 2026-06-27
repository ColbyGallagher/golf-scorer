'use client';

import { useGameStore } from '../../../store/gameStore';

interface Props {
  hole: number;
}

export default function HoleMeta({ hole }: Props) {
  const pars    = useGameStore(s => s.pars);
  const indices = useGameStore(s => s.indices);

  const par = pars[hole];
  const idx = indices[hole];

  const badgeCls = par === 3 ? 'par3-badge' : par === 5 ? 'par5-badge' : 'par4-badge';

  return (
    <div className="hole-meta">
      <span className="idx-badge">SI <strong style={{ color: 'var(--cream)' }}>{idx}</strong></span>
      <span className={`hole-type-badge ${badgeCls}`}>Par {par}</span>
    </div>
  );
}
