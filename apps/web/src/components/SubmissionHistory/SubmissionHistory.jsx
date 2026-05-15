// Submission history — shows all submissions for a student
// Used by both StudentDashboard (student view) and ProgrammeChoicesTab (teacher view)
import { useQuery } from '@tanstack/react-query';
import client from '@schoolchoice/ui/api/client';

const STATUS_STYLES = {
  draft: { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
  approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  revision_requested: { bg: '#fee2e2', color: '#991b1b', label: 'Revision Requested' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SubmissionHistory({ studentId, isStudent = false }) {
  const historyQuery = useQuery({
    queryKey: ['submission-history', studentId, isStudent],
    queryFn: async () => {
      if (isStudent) {
        // Student endpoint
        const r = await client.get('/api/v1/student/choices/history');
        return r.data.submissions ?? [];
      } else {
        // Teacher endpoint
        const r = await client.get(`/api/v1/submissions/student/${studentId}`);
        return r.data.submissions ?? [];
      }
    },
  });

  const submissions = historyQuery.data ?? [];

  if (historyQuery.isLoading) return <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-3)' }}>Loading history…</div>;
  if (submissions.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
        Submission History
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Submitted</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Choices</th>
              <th style={thStyle}>Reviewed</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const st = STATUS_STYLES[s.status] || STATUS_STYLES.draft;
              const choiceCount = Array.isArray(s.choices) ? s.choices.length : 0;
              return (
                <tr key={s.id}>
                  <td style={tdStyle}>{formatDate(s.submitted_at || s.created_at)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={tdStyle}>{choiceCount} programme{choiceCount !== 1 ? 's' : ''}</td>
                  <td style={tdStyle}>{formatDate(s.reviewed_at)}</td>
                  <td style={{ ...tdStyle, maxWidth: '260px', fontSize: 'var(--font-size-xs)', color: s.counsellor_notes ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {s.counsellor_notes || '—'}
                    {s.flagged_choices && s.flagged_choices.length > 0 && (
                      <div style={{ marginTop: '4px', color: '#dc2626', fontSize: 'var(--font-size-xs)' }}>
                        ⚑ {s.flagged_choices.length} choice(s) flagged
                        {s.flagged_choices.slice(0, 3).map((f) => (
                          <div key={f.rank} style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                            志願 {f.rank}{f.note ? `: ${f.note}` : ''}
                          </div>
                        ))}
                        {s.flagged_choices.length > 3 && (
                          <div style={{ marginLeft: '8px', fontStyle: 'italic' }}>…and {s.flagged_choices.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: 'var(--space-2) var(--space-3)', textAlign: 'left',
  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)',
  verticalAlign: 'middle',
};
