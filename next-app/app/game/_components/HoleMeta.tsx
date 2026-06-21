'use client';

import { useGameStore } from '../../../store/gameStore';

interface Props {
  hole: number;
}

export default function HoleMeta({ hole }: Props) {
  const pars    = useGameStore(s => s.pars);
  const indices = useGameStore(s => s.indices);
  const setPars = useGameStore(s => s.setPars);

  const par = pars[hole];
  const idx = indices[hole];

  function adjustPar(delta: number) {
    const next = [...pars];
    next[hole] = Math.max(3, Math.min(5, par + delta));
    setPars(next);
  }

  const badgeCls = par === 3 ? 'par3-badge' : par === 5 ? 'par5-badge' : 'par4-badge';

  return (
    <div className="hole-meta">
      <span className="par-label">Par</span>
      <div className="par-control">
        <button className="par-btn" onClick={() => adjustPar(-1)}>−</button>
        <span className="par-value">{par}</span>
        <button className="par-btn" onClick={() => adjustPar(1)}>+</button>
      </div>
      <span className="idx-badge">SI <strong style={{ color: 'var(--cream)' }}>{idx}</strong></span>
      <span className={`hole-type-badge ${badgeCls}`}>Par {par}</span>
    </div>
  );
}
