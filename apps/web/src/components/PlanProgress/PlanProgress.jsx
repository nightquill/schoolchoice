import { useState, useEffect } from 'react';
import { useTranslation } from '@schoolchoice/ui/i18n';

const STAGES = [
  { key: 'analyzing', duration: 3000 },
  { key: 'matching', duration: 5000 },
  { key: 'generating', duration: 12000 },
  { key: 'formatting', duration: null },
];

export default function PlanProgress({ isActive, isDone }) {
  const { t } = useTranslation();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isActive) { setStageIndex(0); return; }
    const stage = STAGES[stageIndex];
    if (!stage || !stage.duration) return;
    if (stageIndex >= STAGES.length - 1) return;
    const timer = setTimeout(() => setStageIndex(i => Math.min(i + 1, STAGES.length - 1)), stage.duration);
    return () => clearTimeout(timer);
  }, [isActive, stageIndex]);

  useEffect(() => {
    if (isDone) setStageIndex(STAGES.length);
  }, [isDone]);

  if (!isActive && !isDone) return null;

  const progress = isDone ? 100 : Math.min(((stageIndex + 1) / STAGES.length) * 95, 95);
  const stageLabel = isDone
    ? t('plan.progressDone')
    : stageIndex < STAGES.length
      ? t(`plan.progress${STAGES[stageIndex].key.charAt(0).toUpperCase() + STAGES[stageIndex].key.slice(1)}`)
      : t('plan.progressFormatting');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 'var(--space-12) var(--space-4)',
      minHeight: '400px', gap: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', height: '6px',
        background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'var(--color-primary)', borderRadius: '3px',
          transition: 'width 0.8s ease-out',
        }} />
      </div>

      <p style={{
        fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)',
        fontWeight: 'var(--font-weight-medium)', margin: 0,
      }}>
        {stageLabel}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {STAGES.map((s, i) => (
          <div key={s.key} style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: i <= stageIndex || isDone ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}
