'use client';

const CONFLICT_COLORS = [
  { bg: 'rgba(224,85,85,0.18)',    border: 'rgba(224,85,85,0.7)',    text: '#e86060', hole: 'rgba(224,85,85,0.9)'    },
  { bg: 'rgba(200,130,40,0.18)',   border: 'rgba(200,130,40,0.7)',   text: '#d48830', hole: 'rgba(200,130,40,0.9)'   },
  { bg: 'rgba(140,80,200,0.18)',   border: 'rgba(140,80,200,0.7)',   text: '#a070d0', hole: 'rgba(140,80,200,0.9)'   },
  { bg: 'rgba(40,160,200,0.18)',   border: 'rgba(40,160,200,0.7)',   text: '#30a8d0', hole: 'rgba(40,160,200,0.9)'   },
  { bg: 'rgba(200,80,140,0.18)',   border: 'rgba(200,80,140,0.7)',   text: '#d060a0', hole: 'rgba(200,80,140,0.9)'   },
];

type ConflictColor = typeof CONFLICT_COLORS[0];

function buildConflictMap(indices: number[]): Record<number, ConflictColor> {
  const groups: Record<number, number[]> = {};
  indices.forEach((si, h) => {
    if (!groups[si]) groups[si] = [];
    groups[si].push(h);
  });
  const map: Record<number, ConflictColor> = {};
  let ci = 0;
  Object.values(groups).forEach(holes => {
    if (holes.length > 1) {
      const color = CONFLICT_COLORS[ci % CONFLICT_COLORS.length];
      holes.forEach(h => { map[h] = color; });
      ci++;
    }
  });
  return map;
}

interface Props {
  pars: number[];
  indices: number[];
  onParChange: (hole: number, val: number) => void;
  onIdxChange: (hole: number, val: number) => void;
}

export default function HoleConfirmTable({ pars, indices, onParChange, onIdxChange }: Props) {
  const frontPar    = pars.slice(0, 9).reduce((a, b) => a + b, 0);
  const backPar     = pars.slice(9).reduce((a, b) => a + b, 0);
  const conflictMap = buildConflictMap(indices);

  function siInputStyle(h: number): React.CSSProperties {
    const c = conflictMap[h];
    return c ? { background: c.bg, borderColor: c.border, color: c.text } : {};
  }

  return (
    <table className="course-table">
      <thead>
        <tr>
          <th>H</th>
          <th>Par</th>
          <th>SI</th>
          <th style={{ width: 8, borderLeft: '1px solid rgba(245,240,232,0.06)' }} />
          <th>H</th>
          <th>Par</th>
          <th>SI</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 9 }, (_, i) => (
          <tr key={i}>
            <td style={{ color: conflictMap[i] ? conflictMap[i].hole : 'var(--gold)', fontWeight: 600 }}>{i + 1}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <button className="ct-par-btn" onClick={() => onParChange(i, Math.max(3, pars[i] - 1))}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, color: 'var(--cream)' }}>{pars[i]}</span>
                <button className="ct-par-btn" onClick={() => onParChange(i, Math.min(5, pars[i] + 1))}>+</button>
              </div>
            </td>
            <td>
              <input
                className="ct-idx-input"
                type="number"
                inputMode="numeric"
                min={1} max={18}
                value={indices[i]}
                onChange={e => onIdxChange(i, parseInt(e.target.value) || indices[i])}
                style={siInputStyle(i)}
              />
            </td>
            <td style={{ borderLeft: '1px solid rgba(245,240,232,0.06)' }} />
            <td style={{ color: conflictMap[i + 9] ? conflictMap[i + 9].hole : 'var(--gold)', fontWeight: 600 }}>{i + 10}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <button className="ct-par-btn" onClick={() => onParChange(i + 9, Math.max(3, pars[i + 9] - 1))}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, color: 'var(--cream)' }}>{pars[i + 9]}</span>
                <button className="ct-par-btn" onClick={() => onParChange(i + 9, Math.min(5, pars[i + 9] + 1))}>+</button>
              </div>
            </td>
            <td>
              <input
                className="ct-idx-input"
                type="number"
                inputMode="numeric"
                min={1} max={18}
                value={indices[i + 9]}
                onChange={e => onIdxChange(i + 9, parseInt(e.target.value) || indices[i + 9])}
                style={siInputStyle(i + 9)}
              />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ fontSize: 10, borderTop: '1px solid rgba(245,240,232,0.1)' }}>
          <td colSpan={2} style={{ padding: '5px 3px', textAlign: 'right', color: 'rgba(245,240,232,0.35)' }}>Front</td>
          <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 700 }}>{frontPar}</td>
          <td />
          <td colSpan={2} style={{ padding: '5px 3px', textAlign: 'right', color: 'rgba(245,240,232,0.35)' }}>Back</td>
          <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 700 }}>{backPar}</td>
        </tr>
      </tfoot>
    </table>
  );
}
