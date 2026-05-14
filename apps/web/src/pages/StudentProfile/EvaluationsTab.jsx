import { useEvaluationsTab } from '../../hooks/useEvaluationsTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { LoadingSpinner } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { StarRating } from '@schoolchoice/ui';

export default function EvaluationsTab({ studentId }) {
  const {
    evaluations,
    loading,
    saving,
    saveAll,
    addEval,
    updateEval,
    removeEval,
  } = useEvaluationsTab(studentId);
  const { t } = useTranslation();
  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-5)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
  };

  if (loading) return <LoadingSpinner label={t("evaluations.loading")} />;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button variant="secondary" onClick={addEval}>{t('evaluations.addEvaluation')}</Button>
      </div>
      {evaluations.map((ev, index) => (
        <div key={index} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('evaluations.subjectCode')}</label>
              <input value={ev.subject_code || ''} onChange={(e) => updateEval(index, 'subject_code', e.target.value)} style={inputStyle} aria-label="Subject code" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('evaluations.teacherName')}</label>
              <input value={ev.teacher_name || ''} onChange={(e) => updateEval(index, 'teacher_name', e.target.value)} style={inputStyle} aria-label="Teacher name" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('evaluations.rating')}</label>
            <StarRating value={ev.rating} onChange={(v) => updateEval(index, 'rating', v)} label={ev.subject_code || `Evaluation ${index + 1}`} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('evaluations.comment')}</label>
            <textarea
              value={ev.comment || ''}
              onChange={(e) => updateEval(index, 'comment', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              aria-label="Teacher comment"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('evaluations.date')}</label>
            <input type="date" value={ev.date || ''} onChange={(e) => updateEval(index, 'date', e.target.value)} style={inputStyle} aria-label="Evaluation date" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button onClick={() => saveAll(evaluations)} disabled={saving === 'all'}>
              {saving === 'all' ? t('common.loading') : t('evaluations.save')}
            </Button>
            <Button variant="destructive" onClick={() => removeEval(index)}>{t('evaluations.delete')}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
