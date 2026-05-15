// Other tab — combines evaluations, activities/awards, and notes
import { useState } from 'react';
import { useTranslation } from '@schoolchoice/ui/i18n';
import EvaluationsTab from './EvaluationsTab';
import ActivitiesTab from './ActivitiesTab';
import NotesTab from './NotesTab';

const SECTIONS = ['evaluations', 'activities', 'notes'];

export default function OtherTab({ studentId, student, onSaved }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState('evaluations');

  const sectionLabels = {
    evaluations: t('profile.tabs.evaluations'),
    activities: t('profile.tabs.activities'),
    notes: t('profile.tabs.notes'),
  };

  const toggleStyle = (id) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: expanded === id ? 'var(--color-primary)' : 'none',
    color: expanded === id ? '#fff' : 'var(--color-text-secondary)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: expanded === id ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {SECTIONS.map((id) => (
          <button key={id} onClick={() => setExpanded(id)} style={toggleStyle(id)}>
            {sectionLabels[id]}
          </button>
        ))}
      </div>

      {expanded === 'evaluations' && <EvaluationsTab studentId={studentId} />}
      {expanded === 'activities' && <ActivitiesTab studentId={studentId} student={student} />}
      {expanded === 'notes' && <NotesTab studentId={studentId} student={student} onSaved={onSaved} />}
    </div>
  );
}
