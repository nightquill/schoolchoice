import { useEvaluationsTab } from '../../hooks/useEvaluationsTab';
import { LoadingSpinner } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { StarRating } from '@schoolchoice/ui';

export default function EvaluationsTab({ studentId, showToast }) {
  const {
    evaluations,
    loading,
    saving,
    saveAll,
    addEval,
    updateEval,
    removeEval,
  } = useEvaluationsTab(studentId, showToast);

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

  if (loading) return <LoadingSpinner label="Loading evaluations..." />;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button variant="secondary" onClick={addEval}>Add Evaluation</Button>
      </div>
      {evaluations.map((ev, index) => (
        <div key={index} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Subject</label>
              <input value={ev.subject_code || ''} onChange={(e) => updateEval(index, 'subject_code', e.target.value)} style={inputStyle} aria-label="Subject code" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Teacher Name</label>
              <input value={ev.teacher_name || ''} onChange={(e) => updateEval(index, 'teacher_name', e.target.value)} style={inputStyle} aria-label="Teacher name" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Rating</label>
            <StarRating value={ev.rating} onChange={(v) => updateEval(index, 'rating', v)} label={ev.subject_code || `Evaluation ${index + 1}`} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Comment</label>
            <textarea
              value={ev.comment || ''}
              onChange={(e) => updateEval(index, 'comment', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              aria-label="Teacher comment"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Date</label>
            <input type="date" value={ev.date || ''} onChange={(e) => updateEval(index, 'date', e.target.value)} style={inputStyle} aria-label="Evaluation date" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button onClick={() => saveAll(evaluations)} disabled={saving === 'all'}>
              {saving === 'all' ? 'Loading…' : 'Save'}
            </Button>
            <Button variant="destructive" onClick={() => removeEval(index)}>Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
