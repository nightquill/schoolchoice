// Data Analysis page — HKDSE trends, popular majors, anonymized student directory
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import { getAccount } from '../../api/account';
import { getHkdseTrends, getPopularMajors, getStudentDirectory, getHkdsePopulationStats } from '../../api/analytics';
import { getCohorts } from '../../api/cohorts';

const GRADE_ORDER = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];
const CATEGORY_LABELS = { CORE: 'Core', ELECTIVE: 'Elective', OTHER_LANGUAGE: 'Other Language', APPLIED_LEARNING: 'Applied Learning' };

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
    Promise.all([getAccount(), getHkdseTrends(), getPopularMajors(), getStudentDirectory(), getCohorts(), getHkdsePopulationStats()])
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
    maxWidth: '1200px',
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

      <div style={headerStyle}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
          Data Analysis
        </h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button style={tabBtnStyle('trends')} onClick={() => setActiveSection('trends')}>HKDSE Grade Trends</button>
          <button style={tabBtnStyle('combinations')} onClick={() => setActiveSection('combinations')}>Subject Combinations</button>
          <button style={tabBtnStyle('majors')} onClick={() => setActiveSection('majors')}>Popular Majors</button>
          <button style={tabBtnStyle('directory')} onClick={() => setActiveSection('directory')}>Student Directory</button>
        </div>
      </div>

      {loading && <div style={{ padding: 'var(--space-8)' }}><LoadingSpinner label="Loading analytics…" /></div>}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && (
        <div style={containerStyle}>

          {/* ---- HKDSE Trends ---- */}
          {activeSection === 'trends' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>HKDSE Grade Distribution by Subject ({filteredTrends.length} subject-sitting pairs)</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Sitting:</label>
                  <select value={sittingFilter} onChange={(e) => setSittingFilter(e.target.value)} style={inputStyle}>
                    <option value="">All</option>
                    <option value="MOCK">MOCK</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="OFFICIAL">OFFICIAL</option>
                  </select>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Cohort:</label>
                  <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} style={inputStyle}>
                    <option value="">All Students</option>
                    {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Category:</label>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
                    <option value="">All</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>)}
                  </select>
                </div>
              </div>
              {groupedSubjects.length === 0 && !(populationStats?.subjects?.length > 0) ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No grade data available. Add students with grades to see trends." />
                </div>
              ) : (
                <div style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                  {groupedSubjects.length > 0 ? groupedSubjects.map((subj) => {
                    const totalStudents = subj.sittings.reduce((s, r) => s + (r.count || 0), 0);
                    const avgMean = subj.sittings.length ? subj.sittings.reduce((s, r) => s + r.mean, 0) / subj.sittings.length : 0;
                    const catColors = { CORE: '#2563eb', ELECTIVE: '#7c3aed', OTHER_LANGUAGE: '#0891b2', APPLIED_LEARNING: '#d97706' };
                    return (
                      <div
                        key={subj.subject_code}
                        onClick={() => navigate(`/data-analysis/subjects/${subj.subject_code}`)}
                        style={{
                          background: 'var(--color-surface)',
                          border: 'var(--border-width) solid var(--color-border)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: 'var(--space-3)',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{subj.subject_code}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{subj.subject_name}</div>
                          </div>
                          <span style={{ fontSize: '10px', background: catColors[subj.category] || '#64748b', color: '#fff', padding: '2px 7px', borderRadius: '8px', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                            {CATEGORY_LABELS[subj.category] || subj.category || '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          <span>{totalStudents} students</span>
                          <span>Avg {numericToGrade(avgMean)}</span>
                          <span>{subj.sittings.length} sitting{subj.sittings.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>Click for HKDSE population data →</div>
                      </div>
                    );
                  }) : (populationStats?.subjects ?? []).map((subj) => {
                    const catColors = { CORE: '#2563eb', ELECTIVE: '#7c3aed', OTHER_LANGUAGE: '#0891b2', APPLIED_LEARNING: '#d97706' };
                    return (
                      <div
                        key={subj.code}
                        onClick={() => navigate(`/data-analysis/subjects/${subj.code}`)}
                        style={{
                          background: 'var(--color-surface)',
                          border: 'var(--border-width) solid var(--color-border)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: 'var(--space-3)',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{subj.code}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{subj.name}</div>
                          </div>
                          <span style={{ fontSize: '10px', background: catColors[subj.category] || '#64748b', color: '#fff', padding: '2px 7px', borderRadius: '8px', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                            {CATEGORY_LABELS[subj.category] || subj.category || '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          No student data
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>Click for HKDSE population data →</div>
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
                <span>Elective Subject Combinations by Frequency</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Top pairs and triples of elective subjects taken together
                </span>
              </div>
              {subjectCombinations.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No combination data yet. Add elective grades to see patterns." />
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
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.frequency} students</span>
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
                <span>Popular Intended Majors</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {majors?.total_distinct ?? 0} distinct majors across all targets and graduates
                </span>
              </div>
              {!majors?.majors?.length ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No major data yet. Add intended majors to target schools to see trends." />
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

          {/* ---- Anonymized Student Directory ---- */}
          {activeSection === 'directory' && (
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>Anonymized Student Directory</span>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={graduatedOnly} onChange={(e) => setGraduatedOnly(e.target.checked)} />
                    Graduated only
                  </label>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {directory?.total ?? 0} students · Names/contacts removed
                  </span>
                </div>
              </div>
              {!directory?.students?.length ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No student data available." />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Anon ID</th>
                        <th style={thStyle}>Class</th>
                        <th style={thStyle}>Year</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Final School / Major</th>
                        <th style={thStyle}>Subjects (grades)</th>
                        <th style={thStyle}>School Outcomes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directory.students.map((s) => (
                        <tr key={s.anon_id}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{s.anon_id}</td>
                          <td style={tdStyle}>{s.class_name || '—'}</td>
                          <td style={tdStyle}>{s.year_of_study || '—'}</td>
                          <td style={tdStyle}>
                            {s.is_graduated ? (
                              <span style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-success)', color: '#fff', padding: '1px 6px', borderRadius: '8px' }}>
                                Grad {s.graduation_year || ''}
                              </span>
                            ) : (
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Active</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 'var(--font-size-xs)' }}>
                            {s.final_school && <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{s.final_school}</div>}
                            {s.final_major && <div style={{ color: 'var(--color-text-secondary)' }}>{s.final_major}</div>}
                            {!s.final_school && !s.final_major && '—'}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 'var(--font-size-xs)', maxWidth: '180px' }}>
                            {Object.entries(s.grades || {}).map(([k, v]) => `${k}:${v}`).join(' ')}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 'var(--font-size-xs)', maxWidth: '200px' }}>
                            {(s.school_outcomes || []).map((o) => (
                              <span
                                key={o.school_id}
                                style={{
                                  display: 'inline-block',
                                  marginRight: '4px',
                                  marginBottom: '2px',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: o.status === 'ADMITTED' ? 'var(--color-success)' : o.status === 'REJECTED' ? 'var(--color-error)' : 'var(--color-background)',
                                  color: o.status === 'ADMITTED' || o.status === 'REJECTED' ? '#fff' : 'var(--color-text-secondary)',
                                  border: 'var(--border-width) solid var(--color-border)',
                                }}
                              >
                                {o.status}
                                {o.intended_majors?.length > 0 && ` (${o.intended_majors[0]})`}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default DataAnalysis;
