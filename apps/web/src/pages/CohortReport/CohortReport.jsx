// Decision #15: Cohort Report page — target distribution, risk breakdown, subject performance
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

// API helpers
const getTargetDistribution = (cohortId) =>
  client.get(`/api/v1/reports/cohort/${cohortId}/target-distribution`).then((r) => r.data);
const getRiskBreakdown = (cohortId) =>
  client.get(`/api/v1/reports/cohort/${cohortId}/risk-breakdown`).then((r) => r.data);
const getSubjectPerformance = (cohortId, sitting) =>
  client.get(`/api/v1/reports/cohort/${cohortId}/subject-performance`, { params: { sitting } }).then((r) => r.data);

// Grade display helper
const GRADE_LABELS = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };
function numericToGrade(n) {
  const rounded = Math.max(0, Math.min(7, Math.round(n)));
  return GRADE_LABELS[rounded] || 'U';
}

function CohortReport() {
  const { t } = useTranslation();  const { cohortId } = useParams();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [targetDist, setTargetDist] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [perfData, setPerfData] = useState(null);
  const [sitting, setSitting] = useState('MOCK');

  useEffect(() => {
    getAccount().then(setAccount).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getTargetDistribution(cohortId),
      getRiskBreakdown(cohortId),
      getSubjectPerformance(cohortId, sitting),
    ])
      .then(([dist, risk, perf]) => {
        setTargetDist(dist);
        setRiskData(risk);
        setPerfData(perf);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || t('cohortReport.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [cohortId, sitting]);

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const containerStyle = {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: 'var(--space-6) var(--space-8)',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-md)',
    border: 'var(--border-width) solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 'var(--space-6)',
    overflow: 'hidden',
  };

  const sectionTitleStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const thStyle = {
    padding: 'var(--space-2) var(--space-3)',
    textAlign: 'left',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    verticalAlign: 'top',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    boxSizing: 'border-box',
    minWidth: '120px',
  };

  const cohortName = targetDist?.cohort_name || riskData?.cohort_name || '';

  // Compute max count for bar chart scaling
  const maxCount = targetDist?.distribution?.length
    ? Math.max(...targetDist.distribution.map((d) => d.count))
    : 1;

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/cohorts/${cohortId}`} style={backLinkStyle}>
        {t('cohortDetail.backToCohorts')}
      </Link>

      {loading && <LoadingSpinner label={t('cohortReport.loadingReport')} />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
        </div>
      )}

      {!loading && !error && (
        <div style={containerStyle}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-6)' }}>
            {cohortName} &mdash; {t('cohortReport.cohortReport')}
          </h1>

          {/* ---------- Target Distribution ---------- */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <span>{t('cohortReport.targetDistribution')}</span>
            </div>
            {!targetDist?.distribution?.length ? (
              <div style={{ padding: 'var(--space-5)' }}>
                <EmptyState message={t('cohortReport.noTargetData')} />
              </div>
            ) : (
              <div style={{ padding: 'var(--space-4)' }}>
                {targetDist.distribution.map((d) => (
                  <div key={d.school} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                    <div style={{ width: '200px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.school}
                    </div>
                    <div style={{ flex: 1, background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', height: '24px' }}>
                      <div
                        style={{
                          width: `${Math.max((d.count / maxCount) * 100, 2)}%`,
                          background: 'var(--color-primary)',
                          height: '100%',
                          borderRadius: 'var(--border-radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 'var(--space-2)',
                        }}
                      >
                        <span style={{ fontSize: 'var(--font-size-xs)', color: '#fff', fontWeight: 'var(--font-weight-medium)' }}>
                          {d.count}
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '80px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                      {d.avg_score != null ? `${t('cohortReport.avg')} ${d.avg_score}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Risk Breakdown ---------- */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <span>{t('cohortReport.riskBreakdown')}</span>
            </div>
            {!riskData?.breakdown?.length ? (
              <div style={{ padding: 'var(--space-5)' }}>
                <EmptyState message={t('cohortReport.noRiskData')} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('cohortDetail.class')}</th>
                      <th style={thStyle}>{t('cohortReport.totalStudents')}</th>
                      <th style={thStyle}>{t('cohortReport.atRisk')}</th>
                      <th style={thStyle}>{t('cohortReport.riskPct')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskData.breakdown.map((row) => {
                      const riskColor =
                        row.risk_pct >= 50
                          ? 'var(--color-error)'
                          : row.risk_pct >= 25
                          ? 'var(--color-warning, #f59e0b)'
                          : 'var(--color-success, #10b981)';
                      return (
                        <tr key={row.class_name}>
                          <td style={tdStyle}>{row.class_name}</td>
                          <td style={tdStyle}>{row.total_students}</td>
                          <td style={tdStyle}>{row.at_risk_students}</td>
                          <td style={{ ...tdStyle, color: riskColor, fontWeight: 'var(--font-weight-medium)' }}>
                            {row.risk_pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------- Subject Performance ---------- */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <span>{t('cohortReport.subjectPerformance')}</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <label htmlFor="perf-sitting" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('cohortDetail.sitting')}
                </label>
                <select
                  id="perf-sitting"
                  value={sitting}
                  onChange={(e) => setSitting(e.target.value)}
                  style={inputStyle}
                >
                  <option value="MOCK">{t('common.mock')}</option>
                  <option value="TRIAL">{t('common.trial')}</option>
                  <option value="OFFICIAL">{t('common.official')}</option>
                </select>
              </div>
            </div>
            {!perfData?.subjects?.length ? (
              <div style={{ padding: 'var(--space-5)' }}>
                <EmptyState message={t('cohortReport.noSubjectPerfData')} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('cohortReport.code')}</th>
                      <th style={thStyle}>{t('cohortReport.subject')}</th>
                      <th style={thStyle}>{t('cohortDetail.students')}</th>
                      <th style={thStyle}>{t('cohortReport.mean')}</th>
                      <th style={thStyle}>{t('cohortReport.min')}</th>
                      <th style={thStyle}>{t('cohortReport.max')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfData.subjects.map((s) => (
                      <tr key={s.code}>
                        <td style={tdStyle}>{s.code}</td>
                        <td style={tdStyle}>{s.name}</td>
                        <td style={tdStyle}>{s.count}</td>
                        <td style={tdStyle}>{numericToGrade(s.mean)} ({s.mean})</td>
                        <td style={tdStyle}>{numericToGrade(s.min)} ({s.min})</td>
                        <td style={tdStyle}>{numericToGrade(s.max)} ({s.max})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CohortReport;
