import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSubmissions } from '../../api/submissions';
import { getSubmissionHistory } from '../../api/analytics';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRANULARITIES = ['daily', 'weekly', 'monthly'];

function SubmissionList() {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState('daily');
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const submissionsQuery = useQuery({ queryKey: ['submissions'], queryFn: getSubmissions });
  const historyQuery = useQuery({
    queryKey: ['analytics', 'submission-history', granularity],
    queryFn: () => getSubmissionHistory({ granularity, days: 90 }),
  });
  const chartData = historyQuery.data?.data ?? [];

  const account = accountQuery.data ?? null;
  const submissions = submissionsQuery.data?.submissions ?? [];
  const loading = submissionsQuery.isLoading;
  const error = submissionsQuery.error;

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100dvh',
    fontFamily: 'var(--font-family-base)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    textWrap: 'balance',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    background: 'var(--color-background)',
  };

  const tdStyle = {
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <h1 style={{ ...headingStyle, marginBottom: 'var(--space-4)' }}>
          {t('analytics.submissionHistory')}
        </h1>

        {/* Submission history chart */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            {historyQuery.data && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {t('analytics.total')}: {historyQuery.data.total_submissions} submitted, {historyQuery.data.total_approved} approved
              </p>
            )}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
              {GRANULARITIES.map((g) => (
                <button key={g} onClick={() => setGranularity(g)} style={{
                  padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family-base)',
                  border: 'none', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                  background: granularity === g ? 'var(--color-surface)' : 'transparent',
                  color: granularity === g ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  boxShadow: granularity === g ? 'var(--shadow-sm)' : 'none',
                }} aria-pressed={granularity === g}>
                  {t(`analytics.${g}`)}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)' }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                    tickFormatter={(v) => { const d = new Date(v); return granularity === 'monthly' ? d.toLocaleDateString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })} contentStyle={{ fontSize: 13, borderRadius: 6 }} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.totalSubmissions')} />
                  <Line type="monotone" dataKey="approved" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.approvedSubmissions')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
          {t('submissions.pendingSubmissions')} {!loading && !error ? `(${submissions.length})` : ''}
        </h2>

        {loading && <LoadingSpinner label={t('submissions.loadingSubmission')} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && submissions.length === 0 && (
          <EmptyState message={t('submissions.noChoices')} />
        )}
        {!loading && !error && submissions.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle} aria-label={t('submissions.pendingSubmissions')}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('cohortDetail.name')}</th>
                  <th style={thStyle}>{t('submissions.classLabel')}</th>
                  <th style={thStyle}>{t('submissions.choicesHeader')}</th>
                  <th style={thStyle}>{t('submissions.submitted')}</th>
                  <th style={thStyle}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={tdStyle}>{sub.student_name || t('submissions.unknownStudent')}</td>
                    <td style={tdStyle}>{sub.class_name || '-'}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{sub.choice_count ?? sub.choices?.length ?? '-'}</td>
                    <td style={tdStyle}>
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/submissions/${sub.id}`}
                        style={{
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          fontWeight: 'var(--font-weight-medium)',
                        }}
                      >
                        {t('submissions.reviewAction')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default SubmissionList;
