'use client';

interface Props {
  pars: number[];
  indices: number[];
  onParChange: (hole: number, val: number) => void;
  onIdxChange: (hole: number, val: number) => void;
}

export default function HoleConfirmTable({ pars, indices, onParChange, onIdxChange }: Props) {
  const frontPar = pars.slice(0, 9).reduce((a, b) => a + b, 0);
  const backPar  = pars.slice(9).reduce((a, b) => a + b, 0);

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
            <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{i + 1}</td>
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
              />
            </td>
            <td style={{ borderLeft: '1px solid rgba(245,240,232,0.06)' }} />
            <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{i + 10}</td>
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
