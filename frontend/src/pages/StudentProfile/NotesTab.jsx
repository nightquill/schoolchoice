import { useNotesTab } from '../../hooks/useNotesTab';

export default function NotesTab({ studentId, student, onSaved, showToast }) {
  const { notes, saveStatus, handleChange } = useNotesTab(student, studentId, showToast, onSaved);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <label htmlFor="counsellor-notes" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
          Counsellor Notes
        </label>
        {saveStatus === 'saving' && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Saving{'…'}</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>{'\u2713'} Saved</span>
        )}
      </div>
      <textarea
        id="counsellor-notes"
        value={notes}
        onChange={handleChange}
        rows={12}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-3)',
          border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 'var(--font-size-md)',
          fontFamily: 'var(--font-family-base)',
          color: 'var(--color-text-primary)',
          resize: 'vertical',
          lineHeight: 'var(--line-height-normal)',
        }}
        aria-label="Counsellor notes"
      />
    </div>
  );
}
