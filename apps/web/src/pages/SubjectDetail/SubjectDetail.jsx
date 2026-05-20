// Subject Detail page — full analysis for a single HKDSE subject
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getHkdseTrends, getHkdsePopulationStats } from '../../api/analytics';
import { getCohorts } from '../../api/cohorts';

const GRADE_ORDER = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];
// CATEGORY_LABELS moved inside component to use t()
const GRADE_LABELS = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };

function numericToGrade(n) {
  return GRADE_LABELS[Math.max(0, Math.min(7, Math.round(n)))] || 'U';
}

// ---- Grade distribution bar ----
function GradeBar({ dist }) {
  const barStyle = { display: 'flex', gap: '4px', alignItems: 'flex-end', height: '80px', marginTop: '4px' };
  const colors = { '5**': '#1a7c3e', '5*': '#22c55e', '5': '#4ade80', '4': '#86efac', '3': '#fbbf24', '2': '#f97316', '1': '#ef4444', 'U': '#94a3b8' };
  const max = Math.max(...GRADE_ORDER.map((g) => dist[g] || 0), 1);
  return (
    <div style={barStyle} aria-label="Grade distribution">
      {GRADE_ORDER.map((g) => {
        const n = dist[g] || 0;
        const pct = (n / max) * 100;
        return (
          <div key={g} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', maxWidth: '50px' }} title={`${g}: ${n}`}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>{n > 0 ? n : ''}</div>
            <div style={{ width: '100%', height: `${pct}%`, background: colors[g] || '#94a3b8', borderRadius: '2px 2px 0 0', minHeight: n > 0 ? '4px' : 0 }} />
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 'bold' }}>{g}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Vertical Bar Chart (polished) ----
const BAR_COLORS = {
  '5**': '#7c3aed',
  '5*': '#2563eb',
  '5': '#0891b2',
  '4': '#16a34a',
  '3': '#ca8a04',
  '2': '#ea580c',
  '1': '#dc2626',
  'U': '#9ca3af',
};

function deriveChartStats(distribution) {
  const NUMERIC = { '5**': 7, '5*': 6, '5': 5, '4': 4, '3': 3, '2': 2, '1': 1, 'U': 0 };
  const entries = GRADE_ORDER.map((g) => ({ g, v: distribution[g] || 0 })).filter((e) => e.v > 0);
  const totalN = entries.reduce((s, e) => s + e.v, 0);
  if (totalN === 0) return { mean: null, mode: null, totalN: 0 };
  const sumWeighted = entries.reduce((s, e) => s + NUMERIC[e.g] * e.v, 0);
  const meanNum = sumWeighted / totalN;
  const GRADE_LABELS_MAP = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };
  const meanGrade = GRADE_LABELS_MAP[Math.round(meanNum)] || 'U';
  const modeEntry = entries.reduce((best, e) => (e.v > best.v ? e : best), entries[0]);
  return { mean: meanGrade, meanNum: meanNum.toFixed(1), mode: modeEntry.g, totalN };
}

function VerticalBarChart({ distribution, title, mean, mode, totalN, statsLabel }) {
  const [hoveredGrade, setHoveredGrade] = useState(null);
  if (!distribution) return null;

  const MAX_HEIGHT = 160;
  const values = GRADE_ORDER.map((g) => distribution[g] || 0);
  const max = Math.max(...values, 1);
  const isPercent = values.reduce((s, v) => s + v, 0) > 90;

  const stats = (mean == null) ? deriveChartStats(distribution) : { mean, mode, totalN };
  const gridLines = [0.25, 0.5, 0.75, 1.0];

  return (
    <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px', marginTop: 'var(--space-2)' }}>
      {title && (
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>{title}</div>
      )}
      <div style={{ position: 'relative' }}>
        {/* Horizontal gridlines */}
        <div style={{ position: 'absolute', inset: `0 0 20px 0`, pointerEvents: 'none' }}>
          {gridLines.map((frac) => (
            <div key={frac} style={{
              position: 'absolute',
              bottom: `${frac * MAX_HEIGHT}px`,
              left: 0,
              right: 0,
              height: '1px',
              background: 'rgba(0,0,0,0.06)',
            }} />
          ))}
        </div>
        {/* Bar area */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: `${MAX_HEIGHT + 20}px` }} aria-label={title || 'Grade distribution chart'}>
          {GRADE_ORDER.map((g) => {
            const val = distribution[g] || 0;
            const barH = val > 0 ? Math.max(4, Math.round((val / max) * MAX_HEIGHT)) : 0;
            const color = BAR_COLORS[g] || '#9ca3af';
            const isHovered = hoveredGrade === g;
            const suffix = isPercent ? '%' : '';
            return (
              <div
                key={g}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', minWidth: '28px', position: 'relative' }}
                onMouseEnter={() => setHoveredGrade(g)}
                onMouseLeave={() => setHoveredGrade(null)}
              >
                {/* Always-visible value label */}
                <div style={{ fontSize: '11px', color, fontWeight: 'bold', marginBottom: '2px', height: '14px', textAlign: 'center' }}>
                  {val > 0 ? `${val}${suffix}` : ''}
                </div>
                {/* Hover tooltip */}
                {isHovered && val > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: `${barH + 20}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1f2937',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}>
                    {g}: {val}{suffix}
                  </div>
                )}
                {/* Bar */}
                <div style={{
                  width: '100%',
                  height: `${barH}px`,
                  background: color,
                  borderRadius: '4px 4px 0 0',
                  minHeight: val > 0 ? '4px' : '0',
                  opacity: isHovered ? 0.85 : 1,
                  transition: 'opacity 0.1s',
                }} />
                {/* X-axis label */}
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', textAlign: 'center' }}>{g}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Summary line */}
      {stats.totalN > 0 && statsLabel && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
          {statsLabel}
        </div>
      )}
    </div>
  );
}

// ---- Grade Rate Cards ----
function GradeRates({ rates }) {
  if (!rates) return null;
  const colors = { '5**': '#1a7c3e', '5*': '#22c55e', '5': '#4ade80', '4': '#86efac', '3': '#fbbf24', '2': '#f97316' };
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
      {['5**', '5*', '5', '4', '3', '2'].map((g) => {
        const r = rates[g];
        if (r == null) return null;
        return (
          <div key={g} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-2) var(--space-3)', minWidth: '60px' }}>
            <div style={{ width: '100%', height: '4px', background: colors[g] || '#94a3b8', borderRadius: '2px', marginBottom: 'var(--space-1)' }} />
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>{r}%</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>&ge; {g}</div>
          </div>
        );
      })}
    </div>
  );
}

function SubjectDetail() {
  const { subjectCode } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [sittings, setSittings] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCategory, setSubjectCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cohortFilter, setCohortFilter] = useState('');
  const [sittingFilter, setSittingFilter] = useState('');
  const [populationData, setPopulationData] = useState(null);
  const { t } = useTranslation();
  const CATEGORY_LABELS = {
    CORE: t('subjectDetail.categoryCore'),
    ELECTIVE: t('subjectDetail.categoryElective'),
    OTHER_LANGUAGE: t('subjectDetail.categoryOtherLanguage'),
    APPLIED_LEARNING: t('subjectDetail.categoryAppliedLearning'),
  };

  const loadData = (cohort, sitting) => {
    setLoading(true);
    setError(null);
    Promise.all([
      getHkdseTrends(sitting || undefined, cohort || undefined),
      getCohorts(),
      getAccount(),
      getHkdsePopulationStats(subjectCode),
    ])
      .then(([trendsData, cohortsData, accountData, populationStatsData]) => {
        setAccount(accountData);
        setCohorts(Array.isArray(cohortsData) ? cohortsData : (cohortsData.cohorts ?? []));
        const allTrends = trendsData?.trends ?? [];
        const matching = allTrends.filter((r) => r.subject_code === subjectCode);
        if (matching.length > 0) {
          setSubjectName(matching[0].subject_name || subjectCode);
          setSubjectCategory(matching[0].category || '');
        }
        setSittings(matching);
        const popSubject = populationStatsData?.subjects?.find((s) => s.code === subjectCode);
        setPopulationData(popSubject || null);
        if (matching.length === 0 && popSubject) {
          setSubjectName(popSubject.name || subjectCode);
          setSubjectCategory(popSubject.category || '');
        }
      })
      .catch((err) => setError(err?.response?.data?.detail || t('subjectDetail.noData')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData('', '');
  }, [subjectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) loadData(cohortFilter, sittingFilter);
  }, [cohortFilter, sittingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const catColors = { CORE: '#2563eb', ELECTIVE: '#16a34a', OTHER_LANGUAGE: '#7c3aed', APPLIED_LEARNING: '#d97706' };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
  };

  const filteredSittings = sittingFilter ? sittings.filter((r) => r.sitting === sittingFilter) : sittings;

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />

      <div style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4) var(--space-8)' }}>
        <button
          onClick={() => navigate('/data-analysis')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontFamily: 'var(--font-family-base)', padding: 0, marginBottom: 'var(--space-3)', display: 'block' }}
        >
          {t('subjectDetail.backToAnalysis')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
              {subjectCode}
            </h1>
            {subjectName && subjectName !== subjectCode && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>{subjectName}</p>
            )}
          </div>
          {subjectCategory && (
            <span style={{ fontSize: '11px', background: catColors[subjectCategory] || '#64748b', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', letterSpacing: '0.02em' }}>
              {CATEGORY_LABELS[subjectCategory] || subjectCategory}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-6)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('subjectDetail.cohortFilter')}</label>
            <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} style={inputStyle}>
              <option value="">{t('subjectDetail.allStudents')}</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('subjectDetail.sittingFilter')}</label>
            <select value={sittingFilter} onChange={(e) => setSittingFilter(e.target.value)} style={inputStyle}>
              <option value="">{t('subjectDetail.all')}</option>
              <option value="MOCK">{t('common.mock')}</option>
              <option value="TRIAL">{t('common.trial')}</option>
              <option value="OFFICIAL">{t('common.official')}</option>
            </select>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {t('subjectDetail.sittingCount', { count: filteredSittings.length })}
          </span>
        </div>

        {loading && <LoadingSpinner label={t('common.loading')} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && filteredSittings.length === 0 && (
          <div style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            {t('subjectDetail.noData')}
          </div>
        )}

        {!loading && !error && filteredSittings.map((row) => {
          const chartStats = row.grade_distribution ? deriveChartStats(row.grade_distribution) : null;
          return (
            <div key={row.sitting} style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                  {t('subjectDetail.sittingLabel', { sitting: row.sitting })}
                </h2>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('subjectDetail.studentCount', { count: row.count })}
                </span>
              </div>

              {/* Stats summary pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                {[
                  { label: t('subjectDetail.mean'), value: `${numericToGrade(row.mean)} (${row.mean.toFixed(2)})` },
                  { label: t('subjectDetail.variance'), value: row.variance.toFixed(2) },
                  { label: 'n=', value: String(row.count) },
                  ...(row.grade_rates?.['5'] != null ? [{ label: t('subjectDetail.gradeFivePlus'), value: `${row.grade_rates['5']}%` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#f3f4f6', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#6b7280', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Chart — full width, prominent */}
              {row.grade_distribution && (
                <VerticalBarChart
                  distribution={row.grade_distribution}
                  title={t('subjectDetail.gradeDistribution')}
                  mean={chartStats?.mean}
                  mode={chartStats?.mode}
                  totalN={chartStats?.totalN}
                  statsLabel={chartStats?.totalN > 0 ? t('subjectDetail.meanModeN', { mean: chartStats.mean, meanNum: chartStats.meanNum || '', mode: chartStats.mode, totalN: chartStats.totalN }) : null}
                />
              )}

              <div style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('subjectDetail.gradeRates')}
              </div>
              <GradeRates rates={row.grade_rates} />
            </div>
          );
        })}

        {!loading && !error && populationData && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              {t('subjectDetail.populationData')}
            </h2>
            {(populationData.sittings ?? []).map((sitting) => {
              const popChartStats = sitting.grade_distribution ? deriveChartStats(sitting.grade_distribution) : null;
              return (
                <div key={`${sitting.year}-${sitting.sitting_type}`} style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                      {sitting.year} {sitting.sitting_type}
                    </h3>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {sitting.total_candidates != null ? t('subjectDetail.candidates', { count: sitting.total_candidates.toLocaleString() }) : ''}
                    </span>
                  </div>

                  {/* Stats summary pills */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                    {[
                      ...(sitting.mean_numeric != null ? [{ label: t('subjectDetail.mean'), value: `${numericToGrade(sitting.mean_numeric)} (${sitting.mean_numeric.toFixed(2)})` }] : []),
                      ...(sitting.variance != null ? [{ label: t('subjectDetail.variance'), value: sitting.variance.toFixed(2) }] : []),
                      ...(sitting.total_candidates != null ? [{ label: 'n=', value: sitting.total_candidates.toLocaleString() }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#f3f4f6', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#6b7280', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span>{label}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {sitting.grade_distribution && (
                    <VerticalBarChart
                      distribution={sitting.grade_distribution}
                      title={t('subjectDetail.gradeDistributionPct')}
                      mean={popChartStats?.mean}
                      mode={popChartStats?.mode}
                      totalN={popChartStats?.totalN}
                      statsLabel={popChartStats?.totalN > 0 ? t('subjectDetail.meanModeN', { mean: popChartStats.mean, meanNum: popChartStats.meanNum || '', mode: popChartStats.mode, totalN: popChartStats.totalN }) : null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubjectDetail;
