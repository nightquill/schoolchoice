// REQ-093: Student Cohort Detail Page — members + aggregate stats
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Modal } from '@schoolchoice/ui';
import { toast } from 'sonner';
import {
  getCohort,
  getCohortStats,
  addCohortMembers,
  removeCohortMember,
  searchStudents,
} from '../../api/cohorts';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

// ---- Grade-numeric display helpers ----
const GRADE_LABELS = { 7: '5**', 6: '5*', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'U' };
function numericToGrade(n) {
  const rounded = Math.max(0, Math.min(7, Math.round(n)));
  return GRADE_LABELS[rounded] || 'U';
}

// ---- SubjectStatRow ----
function SubjectStatRow({ stat }) {
  const distKeys = Object.keys(stat.grade_distribution).sort((a, b) => {
    const order = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <tr>
      <td style={tdStyle}>{stat.subject_code}</td>
      <td style={tdStyle}>{stat.subject_name}</td>
      <td style={tdStyle}>{stat.sitting}</td>
      <td style={tdStyle}>{stat.count}</td>
      <td style={tdStyle}>{numericToGrade(stat.mean)} ({stat.mean.toFixed(2)})</td>
      <td style={tdStyle}>{stat.variance.toFixed(2)}</td>
      <td style={{ ...tdStyle, fontSize: 'var(--font-size-xs)' }}>
        {distKeys.map((g) => `${g}:${stat.grade_distribution[g]}`).join(' · ')}
      </td>
    </tr>
  );
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
  verticalAlign: 'top',
};

// ---- Main ----
function CohortDetail() {
  const { t } = useTranslation();  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sittingFilter, setSittingFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add students modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchClass, setSearchClass] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [adding, setAdding] = useState(false);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    Promise.all([getCohort(id), getAccount()])
      .then(([cohortData, accountData]) => {
        setCohort(cohortData);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || t('cohortDetail.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadStats = (sitting) => {
    setStatsLoading(true);
    getCohortStats(id, sitting || undefined)
      .then(setStats)
      .catch(() => toast.error(t('cohortDetail.statsFailed')))
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    if (!loading && cohort) loadStats(sittingFilter);
  }, [loading, cohort, sittingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-search when modal opens
  useEffect(() => {
    if (addModalOpen) handleSearch();
  }, [addModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    setSearchLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (searchClass.trim()) params.class_name = searchClass.trim();
      if (searchYear.trim()) params.year_of_study = parseInt(searchYear, 10);
      const result = await searchStudents(params);
      setSearchResults(result.students ?? []);
    } catch {
      toast.error(t('cohortDetail.searchFailed'));
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleSelect = (sid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleAddMembers = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      const updated = await addCohortMembers(id, [...selectedIds]);
      setCohort(updated);
      setAddModalOpen(false);
      setSelectedIds(new Set());
      setSearchResults([]);
      toast.success(t('cohortDetail.addSuccess', { count: selectedIds.size }));
      loadStats(sittingFilter);
    } catch {
      toast.error(t('cohortDetail.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeCohortMember(id, removeTarget.id);
      setCohort((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== removeTarget.id),
      }));
      setRemoveTarget(null);
      toast.success(t('cohortDetail.removeSuccess'));
      loadStats(sittingFilter);
    } catch {
      toast.error(t('cohortDetail.removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const headerStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
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
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    boxSizing: 'border-box',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to="/cohorts" style={backLinkStyle}>{t('cohortDetail.backToCohorts')}</Link>

      {loading && <LoadingSpinner label={t('cohortDetail.loading')} />}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && cohort && (
        <div>
          <div style={headerStyle}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                {cohort.name}
              </h1>
              {cohort.description && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
                  {cohort.description}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button onClick={() => navigate(`/cohorts/${id}/report`)}>{t('cohortDetail.viewReport')}</Button>
              <Button onClick={() => navigate(`/cohorts/${id}/bulk-edit`)}>{t('cohortDetail.bulkEditGrades')}</Button>
              <Button onClick={() => setAddModalOpen(true)}>{t('cohortDetail.addStudents')}</Button>
            </div>
          </div>

          <div style={containerStyle}>
            {/* Members section */}
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('cohortDetail.members')} ({cohort.members.length})</span>
              </div>
              {cohort.members.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('cohortDetail.noStudents')} />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t('cohortDetail.name')}</th>
                        <th style={thStyle}>{t('cohortDetail.class')}</th>
                        <th style={thStyle}>{t('cohortDetail.year')}</th>
                        <th style={thStyle}>{t('cohortDetail.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohort.members.map((member) => (
                        <tr key={member.id}>
                          <td style={tdStyle}>
                            <Link
                              to={`/students/${member.id}/profile`}
                              style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                            >
                              {member.full_name}
                            </Link>
                          </td>
                          <td style={tdStyle}>{member.class_name || '—'}</td>
                          <td style={tdStyle}>{member.year_of_study ?? '—'}</td>
                          <td style={tdStyle}>
                            <button
                              style={{
                                background: 'none',
                                border: 'var(--border-width) solid var(--color-error)',
                                borderRadius: 'var(--border-radius-sm)',
                                color: 'var(--color-error)',
                                fontSize: 'var(--font-size-xs)',
                                padding: 'var(--space-1) var(--space-2)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-family-base)',
                              }}
                              onClick={() => setRemoveTarget(member)}
                              aria-label={`Remove ${member.full_name} from cohort`}
                            >
                              {t('cohortDetail.remove')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Stats section */}
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>{t('cohortDetail.subjectStats')}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="sitting-filter" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {t('cohortDetail.sitting')}
                  </label>
                  <select
                    id="sitting-filter"
                    value={sittingFilter}
                    onChange={(e) => setSittingFilter(e.target.value)}
                    style={{ ...inputStyle, minWidth: '120px' }}
                  >
                    <option value="">{t('cohortDetail.all')}</option>
                    <option value="MOCK">{t('common.mock')}</option>
                    <option value="TRIAL">{t('common.trial')}</option>
                    <option value="OFFICIAL">{t('common.official')}</option>
                  </select>
                  {statsLoading && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Loading…</span>}
                </div>
              </div>

              {!stats || stats.subject_stats.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message={t('cohortDetail.noGradeData')} />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t('cohortDetail.subjectCode')}</th>
                        <th style={thStyle}>{t('cohortDetail.subjectName')}</th>
                        <th style={thStyle}>{t('cohortDetail.sitting')}</th>
                        <th style={thStyle}>{t('cohortDetail.students')}</th>
                        <th style={thStyle}>{t('cohortDetail.meanGrade')}</th>
                        <th style={thStyle}>{t('cohortDetail.variance')}</th>
                        <th style={thStyle}>{t('cohortDetail.distribution')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.subject_stats.map((stat, i) => (
                        <SubjectStatRow key={`${stat.subject_code}-${stat.sitting}-${i}`} stat={stat} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add students modal */}
      <Modal
        isOpen={addModalOpen}
        title={t('cohortDetail.addStudentsTitle')}
        onClose={() => { setAddModalOpen(false); setSelectedIds(new Set()); setSearchResults([]); setSearchQuery(''); setSearchClass(''); setSearchYear(''); }}
        onConfirm={handleAddMembers}
        confirmLabel={adding ? t('cohortDetail.addingLabel') : t('cohortDetail.addSelectedLabel', { count: selectedIds.size })}
        confirmVariant="primary"
      >
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t("cohortDetail.namePlaceholder")}
              style={{ ...inputStyle, flex: '2 1 120px' }}
              aria-label="Search by name"
            />
            <input
              value={searchClass}
              onChange={(e) => setSearchClass(e.target.value)}
              placeholder={t("cohortDetail.classPlaceholder")}
              style={{ ...inputStyle, flex: '1 1 80px' }}
              aria-label="Filter by class"
            />
            <input
              value={searchYear}
              onChange={(e) => setSearchYear(e.target.value)}
              placeholder={t("cohortDetail.yearPlaceholder")}
              type="number"
              style={{ ...inputStyle, flex: '1 1 60px' }}
              aria-label="Filter by year"
            />
            <Button onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? t('schools.searching') : t('cohortDetail.searchBtn')}
            </Button>
          </div>

          {searchResults.length === 0 && !searchLoading && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {t('cohortDetail.showingAll')}
            </p>
          )}

          {searchResults.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '260px', overflowY: 'auto' }}>
              {searchResults.map((s) => {
                const alreadyMember = cohort?.members.some((m) => m.id === s.id);
                const selected = selectedIds.has(s.id);
                return (
                  <li
                    key={s.id}
                    onClick={() => !alreadyMember && toggleSelect(s.id)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      cursor: alreadyMember ? 'default' : 'pointer',
                      background: selected ? 'rgba(37,99,235,0.08)' : 'transparent',
                      border: selected ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                      borderRadius: 'var(--border-radius-sm)',
                      fontSize: 'var(--font-size-sm)',
                      color: alreadyMember ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                      marginBottom: 'var(--space-1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={alreadyMember}
                  >
                    <span>
                      {s.full_name}
                      {s.class_name && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>{s.class_name}</span>}
                      {s.year_of_study && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>Y{s.year_of_study}</span>}
                    </span>
                    {alreadyMember && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('cohortDetail.alreadyInCohort')}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* Remove confirmation modal */}
      <Modal
        isOpen={!!removeTarget}
        title={t('cohortDetail.removeStudent')}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        confirmLabel={removing ? t('cohortDetail.removing') : t('cohortDetail.remove')}
        confirmVariant="danger"
      >
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          {t('cohortDetail.removeConfirm', { name: removeTarget?.full_name })}
        </p>
      </Modal>

    </div>
  );
}

export default CohortDetail;
