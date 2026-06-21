'use client';

import { useGameStore } from '../../store/gameStore';
import SetupStepper from './_components/SetupStepper';
import Step1Course from './_components/Step1Course';
import Step2GameFormat from './_components/Step2GameFormat';
import Step3Players from './_components/Step3Players';

export default function SetupPage() {
  const setupStep    = useGameStore(s => s.setupStep);
  const setSetupStep = useGameStore(s => s.setSetupStep);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 14px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: 'var(--gold)', letterSpacing: '0.5px' }}>
          New Round
        </h1>
      </div>

      <SetupStepper current={setupStep} onBack={setSetupStep} />

      {setupStep === 1 && (
        <Step1Course onNext={() => setSetupStep(2)} />
      )}
      {setupStep === 2 && (
        <Step2GameFormat onBack={() => setSetupStep(1)} onNext={() => setSetupStep(3)} />
      )}
      {setupStep === 3 && (
        <Step3Players onBack={() => setSetupStep(2)} />
      )}
    </div>
  );
}
