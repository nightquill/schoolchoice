import { useLanguageTab } from '../../hooks/useLanguageTab';
import Button from '../../components/Button/Button';

export default function LanguageTab({ student, studentId, showToast }) {
  const {
    ielts,
    otherScores,
    saving,
    updateIelts,
    handleSave,
    addOtherScore,
    removeOtherScore,
    updateOtherScore,
  } = useLanguageTab(student, studentId, showToast);

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
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

  return (
    <div>
      <h3 style={sectionHeadingStyle}>IELTS</h3>
      <div style={gridStyle}>
        {[
          ['Overall Band', 'ielts_score'],
          ['Listening', 'ielts_listening'],
          ['Reading', 'ielts_reading'],
          ['Writing', 'ielts_writing'],
          ['Speaking', 'ielts_speaking'],
          ['Test Date', 'ielts_date'],
        ].map(([label, field]) => (
          <div key={field}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }} htmlFor={`ielts-${field}`}>{label}</label>
            <input
              id={`ielts-${field}`}
              type={field === 'ielts_date' ? 'date' : 'number'}
              value={ielts[field]}
              onChange={(e) => updateIelts(field, e.target.value)}
              step={field !== 'ielts_date' ? '0.5' : undefined}
              min={field !== 'ielts_date' ? '0' : undefined}
              max={field !== 'ielts_date' ? '9' : undefined}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <h3 style={sectionHeadingStyle}>Other Language Scores</h3>
      {otherScores.map((score, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Label</label>
            <input value={score.label} onChange={(e) => updateOtherScore(index, 'label', e.target.value)} style={inputStyle} aria-label="Score label" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Score</label>
            <input value={score.score} onChange={(e) => updateOtherScore(index, 'score', e.target.value)} style={inputStyle} aria-label="Score value" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Date</label>
            <input type="date" value={score.date} onChange={(e) => updateOtherScore(index, 'date', e.target.value)} style={inputStyle} aria-label="Score date" />
          </div>
          <button
            onClick={() => removeOtherScore(index)}
            style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', alignSelf: 'center', paddingBottom: 'var(--space-1)' }}
            aria-label="Remove score"
          >
            Remove
          </button>
        </div>
      ))}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button label="Add Score" variant="secondary" onClick={addOtherScore} />
      </div>
      <Button label="Save" onClick={handleSave} loading={saving} />
    </div>
  );
}
