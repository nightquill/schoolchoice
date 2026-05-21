// Data Analysis page — HKDSE trends, popular majors, anonymized student directory
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import PermissionGate from '../../components/PermissionGate/PermissionGate';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getHkdseTrends, getPopularMajors, getStudentDirectory, getHkdsePopulationStats } from '../../api/analytics';
import { getCohorts } from '../../api/cohorts';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRADE_ORDER = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];
// CATEGORY_LABELS moved inside component to access t()

// ---- Grade distribution bar ----
function GradeBar({ dist }) {
  const barStyle = { display: 'flex', gap: '2px', alignItems: 'flex-end', height: '40px', marginTop: '4px' };
  const grades = GRADE_ORDER.filter((g) => dist[g]);
  const max = Math.max(...grades.map((g) => dist[g]), 1);
  const colors = { '5**': '#1a7c3e', '5*': '#22c55e', '5': '#4ade80', '4': '#86efac', '3': '#fbbf24', '2': '#f97316', '1': '#ef4444', 'U': '#94a3b8' };
  return (
    <div style={barStyle} aria-label="Grade distribution">
      {GRADE_ORDER.map((g) => {
        const n = dist[g] || 0;
        if (!n) return null;
        const pct = (n / max) * 100;
        return (
          <div key={g} title={`${g}: ${n}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', width: '20px' }}>
            <div style={{ width: '100%', height: `${pct}%`, background: colors[g] || '#94a3b8', borderRadius: '2px 2px 0 0', minHeight: '2px' }} />
            <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{g}</span>
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
  const GRADE_LABELS = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };
  const meanGrade = GRADE_LABELS[Math.round(meanNum)] || 'U';
  const modeEntry = entries.reduce((best, e) => (e.v > best.v ? e : best), entries[0]);
  return { mean: meanGrade, meanNum: meanNum.toFixed(1), mode: modeEntry.g, totalN };
}

function VerticalBarChart({ distribution, title, mean, mode, totalN }) {
  const { t } = useTranslation();
  const [hoveredGrade, setHoveredGrade] = useState(null);
  if (!distribution) return null;

  const MAX_HEIGHT = 160;
  const values = GRADE_ORDER.map((g) => distribution[g] || 0);
  const max = Math.max(...values, 1);
  const isPercent = values.reduce((s, v) => s + v, 0) > 90;

  // derive stats if not passed in
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
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: `${MAX_HEIGHT + 20}px`, paddingBottom: '0' }} aria-label={title || 'Grade distribution chart'}>
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
                {/* Always-visible value label above bar */}
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
      {stats.totalN > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
          {t('shap.meanModeN', { mean: stats.mean, meanNum: stats.meanNum ? ` (${stats.meanNum})` : '', mode: stats.mode, totalN: stats.totalN })}
        </div>
      )}
    </div>
  );
}

// ---- Grade Rate Sparkline ----
function GradeRates({ rates }) {
  if (!rates) return null;
  return (
    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
      {['5**', '5*', '5', '4', '3'].map((g) => {
        const r = rates[g];
        if (r == null) return null;
        const colors = { '5**': '#1a7c3e', '5*': '#22c55e', '5': '#4ade80', '4': '#86efac', '3': '#fbbf24' };
        return (
          <span key={g} style={{ fontSize: '9px', background: colors[g], color: g === '4' || g === '5' ? '#166534' : '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }} title={`${r}% achieved ${g} or above`}>
            {g}: {r}%
          </span>
        );
      })}
    </div>
  );
}

// Numeric grade → HKDSE string
const GRADE_LABELS = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };
function numericToGrade(n) {
  return GRADE_LABELS[Math.max(0, Math.min(7, Math.round(n)))] || 'U';
}

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
  verticalAlign: 'middle',
};

function DataAnalysis() {
  const { t } = useTranslation();
  const CATEGORY_LABELS = { CORE: t('dataAnalysis.categoryCore'), ELECTIVE: t('dataAnalysis.categoryElective'), OTHER_LANGUAGE: t('dataAnalysis.categoryOtherLanguage'), APPLIED_LEARNING: t('dataAnalysis.categoryAppliedLearning') };
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [trends, setTrends] = useState(null);
  const [majors, setMajors] = useState(null);
  const [directory, setDirectory] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [populationStats, setPopulationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sittingFilter, setSittingFilter] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeSection, setActiveSection] = useState('trends');
  const [graduatedOnly, setGraduatedOnly] = useState(false);

  useEffect(() => {
    Promise.all([getAccount(), getHkdseTrends(), getPopularMajors(), getStudentDirectory(true), getCohorts(), getHkdsePopulationStats()])
      .then(([accountData, trendsData, majorsData, dirData, cohortsData, populationData]) => {
        setAccount(accountData);
        setTrends(trendsData);
        setMajors(majorsData);
        setDirectory(dirData);
        setCohorts(Array.isArray(cohortsData) ? cohortsData : (cohortsData.cohorts ?? []));
        setPopulationStats(populationData);
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  const reloadTrends = (sitting, cohort) => {
    const params = {};
    if (sitting) params.sitting = sitting;
    if (cohort) params.cohort_id = cohort;
    getHkdseTrends(sitting || undefined, cohort || undefined).then(setTrends).catch(() => {});
  };

  const reloadDirectory = (graduated) => {
    getStudentDirectory(graduated).then(setDirectory).catch(() => {});
  };

  useEffect(() => {
    if (!loading) reloadTrends(sittingFilter, cohortFilter);
  }, [sittingFilter, cohortFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) reloadDirectory(graduatedOnly);
  }, [graduatedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTrends = trends?.trends ?? [];
  const filteredTrends = categoryFilter ? allTrends.filter((r) => r.category === categoryFilter) : allTrends;
  const subjectCombinations = trends?.subject_combinations ?? [];

  // Group trend rows by subject_code for the summary list
  const subjectMap = {};
  filteredTrends.forEach((row) => {
    if (!subjectMap[row.subject_code]) {
      subjectMap[row.subject_code] = { subject_code: row.subject_code, subject_name: row.subject_name, category: row.category, sittings: [] };
    }
    subjectMap[row.subject_code].sittings.push(row);
  });
  const groupedSubjects = Object.values(subjectMap).sort((a, b) => {
    const catOrder = { CORE: 0, ELECTIVE: 1, OTHER_LANGUAGE: 2, APPLIED_LEARNING: 3 };
    return (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) || a.subject_code.localeCompare(b.subject_code);
  });

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const headerStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
  };

  const containerStyle = {
    maxWidth: '100%',
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
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  };

  const tabBtnStyle = (id) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: activeSection === id ? 'var(--color-primary)' : 'none',
    color: activeSection === id ? '#fff' : 'var(--color-text-secondary)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: activeSection === id ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
  });

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
  };

  // Group trends by category for display
  const categories = [...new Set(allTrends.map((r) => r.category).filter(Boolean))].sort();

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <PermissionGate feature="data_analysis">

      <div style={headerStyle}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
          {t('dataAnalysis.title')}
        </h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button style={tabBtnStyle('trends')} onClick={() => setActiveSection('trends')}>{t('dataAnalysis.hkdseTrends')}</button>
          <button style={tabBtnStyle('combinations')} onClick={() => setActiveSection('combinations')}>{t('dataAnalysis.subjectCombinations')}</button>
          <button style={tabBtnStyle('majors')} onClick={() => setActiveSection('majors')}>{t('dataAnalysis.popularMajors')}</button>
          <button style={tabBtnStyle('directory')} onClick={() => setActiveSection('directory')}>{t('dataAnalysis.graduationOutcomes')}</button>
        </div>
      </div>

      {loading && <div style={{ padding: 'var(--space-8)' }}><LoadingSpinner label={t("dataAnalysis.loading")} /></div>}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && (
        <div style={containerStyle}>

          {/* ---- HKDSE Trends ---- */}
          {activeSection === 'trends' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('dataAnalysis.gradeDistribution')} ({filteredTrends.length})</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.sitting')}</label>
                  <select value={sittingFilter} onChange={(e) => setSittingFilter(e.target.value)} style={inputStyle}>
                    <option value="">{t('dataAnalysis.all')}</option>
                    <option value="MOCK">{t('common.mock')}</option>
                    <option value="TRIAL">{t('common.trial')}</option>
                    <option value="OFFICIAL">{t('common.official')}</option>
                  </select>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.cohort')}</label>
                  <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} style={inputStyle}>
                    <option value="">{t('dataAnalysis.allStudents')}</option>
                    {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.category')}</label>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
                    <option value="">{t('dataAnalysis.all')}</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>)}
                  </select>
                </div>
              </div>
              {groupedSubjects.length === 0 && !(populationStats?.subjects?.length > 0) ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('dataAnalysis.noGradeData')} />
                </div>
              ) : (
                <div style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                  {groupedSubjects.length > 0 ? groupedSubjects.map((subj) => {
                    const totalStudents = subj.sittings.reduce((s, r) => s + (r.count || 0), 0);
                    const avgMean = subj.sittings.length ? subj.sittings.reduce((s, r) => s + r.mean, 0) / subj.sittings.length : 0;
                    const catColors = { CORE: '#2563eb', ELECTIVE: '#16a34a', OTHER_LANGUAGE: '#7c3aed', APPLIED_LEARNING: '#d97706' };
                    // Use the best-populated sitting for the chart
                    const bestSitting = subj.sittings.reduce((best, r) => (!best || (r.count || 0) > (best.count || 0)) ? r : best, null);
                    const chartDist = bestSitting?.grade_distribution || null;
                    const chartStats = chartDist ? deriveChartStats(chartDist) : null;
                    return (
                      <div
                        key={subj.subject_code}
                        onClick={() => navigate(`/data-analysis/subjects/${subj.subject_code}`)}
                        style={{
                          background: 'var(--color-surface)',
                          border: 'var(--border-width) solid var(--color-border)',
                          borderRadius: 'var(--border-radius-md)',
                          padding: 'var(--space-4)',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{subj.subject_code}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{subj.subject_name}</div>
                          </div>
                          <span style={{ fontSize: '10px', background: catColors[subj.category] || '#64748b', color: '#fff', padding: '3px 8px', borderRadius: '12px', flexShrink: 0, marginLeft: 'var(--space-2)', fontWeight: 'bold', letterSpacing: '0.02em' }}>
                            {CATEGORY_LABELS[subj.category] || subj.category || '—'}
                          </span>
                        </div>
                        {/* Chart */}
                        {chartDist && <VerticalBarChart distribution={chartDist} />}
                        {/* Stats summary pills */}
                        {chartStats && chartStats.totalN > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {[
                              { label: t('cohortDetail.meanGrade'), value: chartStats.mean },
                              { label: t('cohortDetail.variance'), value: bestSitting?.variance != null ? bestSitting.variance.toFixed(2) : '—' },
                              { label: 'n=', value: String(totalStudents) },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: '#f3f4f6', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', color: '#6b7280', display: 'flex', gap: '3px', alignItems: 'center' }}>
                                <span>{label}</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>{t('dataAnalysis.populationData')}</div>
                      </div>
                    );
                  }) : (populationStats?.subjects ?? []).map((subj) => {
                    const catColors = { CORE: '#2563eb', ELECTIVE: '#16a34a', OTHER_LANGUAGE: '#7c3aed', APPLIED_LEARNING: '#d97706' };
                    return (
                      <div
                        key={subj.code}
                        onClick={() => navigate(`/data-analysis/subjects/${subj.code}`)}
                        style={{
                          background: 'var(--color-surface)',
                          border: 'var(--border-width) solid var(--color-border)',
                          borderRadius: 'var(--border-radius-md)',
                          padding: 'var(--space-4)',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{subj.code}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{subj.name}</div>
                          </div>
                          <span style={{ fontSize: '10px', background: catColors[subj.category] || '#64748b', color: '#fff', padding: '3px 8px', borderRadius: '12px', flexShrink: 0, marginLeft: 'var(--space-2)', fontWeight: 'bold', letterSpacing: '0.02em' }}>
                            {CATEGORY_LABELS[subj.category] || subj.category || '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {t('dataAnalysis.noStudentData')}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>{t('dataAnalysis.populationData')}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Subject Combinations ---- */}
          {activeSection === 'combinations' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('dataAnalysis.electiveCombinations')}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {t('dataAnalysis.topPairs')}
                </span>
              </div>
              {subjectCombinations.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('dataAnalysis.noCombinationData')} />
                </div>
              ) : (
                <div style={{ padding: 'var(--space-4)' }}>
                  {subjectCombinations.map((item, i) => {
                    const max = subjectCombinations[0]?.frequency || 1;
                    const pct = Math.round((item.frequency / max) * 100);
                    return (
                      <div key={item.combination} style={{ marginBottom: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: i < 3 ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)' }}>
                            {i + 1}. {item.combination}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.frequency} {t('cohortDetail.students').toLowerCase()}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--color-background)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: '4px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Popular Majors ---- */}
          {activeSection === 'majors' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('dataAnalysis.popularIntendedMajors')}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {majors?.total_distinct ?? 0} {t('dataAnalysis.distinctMajors')}
                </span>
              </div>
              {!majors?.majors?.length ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('dataAnalysis.noMajorData')} />
                </div>
              ) : (
                <div style={{ padding: 'var(--space-4)' }}>
                  {majors.majors.map((item, i) => {
                    const max = majors.majors[0]?.count || 1;
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.major} style={{ marginBottom: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: i < 3 ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)' }}>
                            {i + 1}. {item.major}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.count}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--color-background)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: '4px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Graduation Outcomes ---- */}
          {activeSection === 'directory' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('dataAnalysis.graduationOutcomes')}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {t('dataAnalysis.graduationOutcomesDesc')}
                </span>
              </div>
              {!directory?.students?.length ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('dataAnalysis.noGraduatedStudents')} />
                </div>
              ) : (() => {
                const grads = (directory.students || []).filter(s => s.is_graduated);
                const withOutcome = grads.filter(s => s.final_school);
                // Aggregate: which schools did graduates go to?
                const schoolCounts = {};
                grads.forEach(s => {
                  const school = s.final_school || 'Unknown';
                  schoolCounts[school] = (schoolCounts[school] || 0) + 1;
                });
                const majorCounts = {};
                grads.forEach(s => {
                  if (s.final_major) majorCounts[s.final_major] = (majorCounts[s.final_major] || 0) + 1;
                });
                const sortedSchools = Object.entries(schoolCounts).sort((a, b) => b[1] - a[1]);
                const sortedMajors = Object.entries(majorCounts).sort((a, b) => b[1] - a[1]);

                return (
                  <div style={{ padding: 'var(--space-4)' }}>
                    {/* Summary cards */}
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
                      <div style={{ flex: '1 1 120px', padding: 'var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>{grads.length}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.graduatedCount')}</div>
                      </div>
                      <div style={{ flex: '1 1 120px', padding: 'var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>{withOutcome.length}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.withRecordedOutcome')}</div>
                      </div>
                      <div style={{ flex: '1 1 120px', padding: 'var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>{sortedSchools.length}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.distinctUniversities')}</div>
                      </div>
                      <div style={{ flex: '1 1 120px', padding: 'var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>{sortedMajors.length}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('dataAnalysis.distinctProgrammes')}</div>
                      </div>
                    </div>

                    {/* Destination distribution */}
                    {sortedSchools.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                          {t('dataAnalysis.universityDestinations')}
                        </h3>
                        {sortedSchools.map(([school, count]) => (
                          <div key={school} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{school}</div>
                            <div style={{ width: '120px' }}>
                              <div style={{ height: '16px', background: 'var(--color-background)', borderRadius: '8px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(count / grads.length) * 100}%`, background: 'var(--color-primary)', borderRadius: '8px', minWidth: '8px' }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', minWidth: '40px', textAlign: 'right' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Programme distribution */}
                    {sortedMajors.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                          {t('dataAnalysis.programmeDistribution')}
                        </h3>
                        {sortedMajors.slice(0, 15).map(([major, count]) => (
                          <div key={major} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{major}</div>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Individual graduate table */}
                    {grads.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                          {t('dataAnalysis.individualOutcomes')}
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>{t('dataAnalysis.class')}</th>
                                <th style={thStyle}>{t('dataAnalysis.year')}</th>
                                <th style={thStyle}>{t('dataAnalysis.graduationYear')}</th>
                                <th style={thStyle}>{t('dataAnalysis.finalUniversity')}</th>
                                <th style={thStyle}>{t('dataAnalysis.finalProgramme')}</th>
                                <th style={thStyle}>{t('dataAnalysis.best5')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grads.map((s) => (
                                <tr key={s.anon_id}>
                                  <td style={tdStyle}>{s.class_name || '—'}</td>
                                  <td style={tdStyle}>{s.year_of_study || '—'}</td>
                                  <td style={tdStyle}>{s.graduation_year || '—'}</td>
                                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)' }}>{s.final_school || '—'}</td>
                                  <td style={tdStyle}>{s.final_major || '—'}</td>
                                  <td style={{ ...tdStyle, fontSize: 'var(--font-size-xs)' }}>
                                    {Object.entries(s.grades || {}).map(([k, v]) => `${k}:${v}`).join(' ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      )}

    </PermissionGate>
    </div>
  );
}

export default DataAnalysis;
