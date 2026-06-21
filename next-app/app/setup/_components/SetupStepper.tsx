'use client';

const STEPS = ['Course', 'Format', 'Players'];

interface Props {
  current: number;
  onBack: (step: number) => void;
}

export default function SetupStepper({ current, onBack }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 20 }}>
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isDone   = step < current;
        const isActive = step === current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: isDone ? 'pointer' : 'default' }}
              onClick={() => isDone && onBack(step)}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: (isDone || isActive) ? 'var(--green-bright)' : 'rgba(245,240,232,0.1)',
                color:      (isDone || isActive) ? '#0a1a0d' : 'rgba(245,240,232,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {isDone ? '✓' : step}
              </div>
              <span style={{
                fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase',
                color: (isDone || isActive) ? 'var(--green-bright)' : 'rgba(245,240,232,0.3)',
              }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 1, margin: '0 6px', marginBottom: 18,
                background: step < current ? 'var(--green-bright)' : 'rgba(245,240,232,0.12)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
