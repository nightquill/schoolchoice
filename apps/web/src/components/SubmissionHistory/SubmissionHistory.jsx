// Submission history — shows all submissions for a student
// Used by both StudentDashboard (student view) and ProgrammeChoicesTab (teacher view)
import { useQuery } from '@tanstack/react-query';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

function formatDate(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dateLocale = locale === 'zh-HK' ? 'zh-HK' : 'en-GB';
  return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', color: '#475569' },
  pending: { bg: '#fef3c7', color: '#92400e' },
  approved: { bg: '#dcfce7', color: '#166534' },
  revision_requested: { bg: '#fee2e2', color: '#991b1b' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
};

const STATUS_KEYS = {
  draft: 'submissionHistory.draft',
  pending: 'submissionHistory.pendingReview',
  approved: 'submissionHistory.approved',
  revision_requested: 'submissionHistory.revisionRequested',
  rejected: 'submissionHistory.rejected',
};

export default function SubmissionHistory({ studentId, isStudent = false }) {
  const { t, locale } = useTranslation();

  const historyQuery = useQuery({
    queryKey: ['submission-history', studentId, isStudent],
    queryFn: async () => {
      if (isStudent) {
        const r = await client.get('/api/v1/student/choices/history');
        return r.data.submissions ?? [];
      } else {
        const r = await client.get(`/api/v1/submissions/student/${studentId}`);
        return r.data.submissions ?? [];
      }
    },
  });

  const submissions = historyQuery.data ?? [];

  if (historyQuery.isLoading) return <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-3)' }}>{t('submissionHistory.loading')}</div>;
  if (submissions.length === 0) return <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>{t('submissionHistory.noSubmissions')}</div>;

  return (
    <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
        {t('submissionHistory.title')}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('submissionHistory.submitted')}</th>
              <th style={thStyle}>{t('submissionHistory.status')}</th>
              <th style={thStyle}>{t('submissionHistory.choices')}</th>
              <th style={thStyle}>{t('submissionHistory.reviewed')}</th>
              <th style={thStyle}>{t('submissionHistory.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const statusKey = STATUS_KEYS[s.status] || STATUS_KEYS.draft;
              const colors = STATUS_COLORS[s.status] || STATUS_COLORS.draft;
              const choiceCount = Array.isArray(s.choices) ? s.choices.length : 0;
              return (
                <tr key={s.id}>
                  <td style={tdStyle}>{formatDate(s.submitted_at || s.created_at, locale)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: colors.bg, color: colors.color }}>
                      {t(statusKey)}
                    </span>
                  </td>
                  <td style={tdStyle}>{t('submissionHistory.programmeCount', { count: choiceCount })}</td>
                  <td style={tdStyle}>{formatDate(s.reviewed_at, locale)}</td>
                  <td style={{ ...tdStyle, maxWidth: '260px', fontSize: 'var(--font-size-xs)', color: s.counsellor_notes ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {s.counsellor_notes || '—'}
                    {s.flagged_choices && s.flagged_choices.length > 0 && (
                      <div style={{ marginTop: '4px', color: '#dc2626', fontSize: 'var(--font-size-xs)' }}>
                        {'\u2691'} {t('submissionHistory.choicesFlagged', { count: s.flagged_choices.length })}
                        {s.flagged_choices.slice(0, 3).map((f) => (
                          <div key={f.rank} style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                            {t('submissionHistory.choiceRank', { rank: f.rank })}{f.note ? `: ${f.note}` : ''}
                          </div>
                        ))}
                        {s.flagged_choices.length > 3 && (
                          <div style={{ marginLeft: '8px', fontStyle: 'italic' }}>{t('submissionHistory.andMore', { count: s.flagged_choices.length - 3 })}</div>
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
