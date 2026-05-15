import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSubmissionHistory } from '../../api/analytics';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRANULARITIES = ['daily', 'weekly', 'monthly'];

export default function SubmissionsAnalytics() {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState('daily');
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'submission-history', granularity],
    queryFn: () => getSubmissionHistory({ granularity, days: 90 }),
  });

  const chartData = data?.data ?? [];

  const toggleStyle = (active) => ({
    flex: 1,
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    fontFamily: 'var(--font-family-base)',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '100%' }}>
        <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-block' }}>
          ← {t('analytics.backToDashboard')}
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, textWrap: 'balance' }}>
            {t('analytics.submissionHistory')}
          </h1>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
            {GRANULARITIES.map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={toggleStyle(granularity === g)} aria-pressed={granularity === g}>
                {t(`analytics.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontVariantNumeric: 'tabular-nums' }}>
            {t('analytics.total')}: {data.total_submissions} submitted, {data.total_approved} approved
          </p>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-12) 0' }}>
            {t('analytics.noData')}
          </p>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return granularity === 'monthly' ? d.toLocaleDateString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }} />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
                  contentStyle={{ fontSize: 13, borderRadius: 6 }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.totalSubmissions')} />
                <Line type="monotone" dataKey="approved" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.approvedSubmissions')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </div>
  );
}
