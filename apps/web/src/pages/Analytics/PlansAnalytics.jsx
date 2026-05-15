import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getPlanHistory } from '../../api/analytics';
import { getStudents } from '../../api/students';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRANULARITIES = ['daily', 'weekly', 'monthly'];

export default function PlansAnalytics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [granularity, setGranularity] = useState('daily');
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'plan-history', granularity],
    queryFn: () => getPlanHistory({ granularity, days: 90 }),
  });

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => getStudents({ limit: 500 }),
    staleTime: 60000,
  });

  const students = Array.isArray(studentsQuery.data) ? studentsQuery.data : (studentsQuery.data?.items ?? []);
  const missingPlan = students.filter(s => !s.has_plan);
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
            {t('analytics.planHistory')}
          </h1>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
            {GRANULARITIES.map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={toggleStyle(granularity === g)} aria-pressed={granularity === g}>
                {t(`analytics.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {data?.total != null && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontVariantNumeric: 'tabular-nums' }}>
            {t('analytics.total')}: {data.total}
          </p>
        )}

        {/* Chart — always shown, even with empty data */}
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.length > 0 ? chartData : [{ date: new Date().toISOString().slice(0, 10), count: 0 }]} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.plansGenerated')} />
              </LineChart>
            </ResponsiveContainer>
            {chartData.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 'var(--space-2) 0 0' }}>
                {t('analytics.noData')}
              </p>
            )}
          </div>
        )}

        {/* Students missing a plan */}
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
          {t('analytics.studentsMissingPlan')} {!studentsQuery.isLoading ? `(${missingPlan.length})` : ''}
        </h2>

        {studentsQuery.isLoading ? (
          <LoadingSpinner />
        ) : missingPlan.length === 0 ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.allStudentsHavePlans')}
          </p>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)', background: 'var(--color-background)' }}>
                    {t('cohortDetail.name')}
                  </th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)', background: 'var(--color-background)' }}>
                    {t('dashboard.class')}
                  </th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)', background: 'var(--color-background)' }}>
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {missingPlan.map((s) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}/consultant`)}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                      {s.full_name || s.name || t('dashboard.unnamedStudent')}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                      {s.class_name || '-'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                      <Link
                        to={`/students/${s.id}/consultant`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'var(--font-weight-medium)' }}
                      >
                        {t('plan.generatePlan')}
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
