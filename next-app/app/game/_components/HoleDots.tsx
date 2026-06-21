'use client';

import { useGameStore, PLAYERS } from '../../../store/gameStore';

interface Props {
  currentHole: number;
  onSelect: (hole: number) => void;
}

export default function HoleDots({ currentHole, onSelect }: Props) {
  const scores = useGameStore(s => s.scores);

  return (
    <div className="hole-dots">
      {Array.from({ length: 18 }, (_, i) => {
        const complete = PLAYERS.every(p => scores[p.id][i] > 0);
        const cls = i === currentHole ? 'current' : complete ? 'complete' : '';
        return (
          <div key={i} className={`hole-dot ${cls}`} onClick={() => onSelect(i)}>
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
