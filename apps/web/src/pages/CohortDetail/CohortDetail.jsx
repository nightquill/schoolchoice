// REQ-093: Student Cohort Detail Page — members + aggregate stats
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Modal } from '@schoolchoice/ui';
import { Toast } from '@schoolchoice/ui';
import { useToast } from '@schoolchoice/ui/hooks/useToast';
import {
  getCohort,
  getCohortStats,
  addCohortMembers,
  removeCohortMember,
  searchStudents,
} from '../../api/cohorts';
import { getAccount } from '@schoolchoice/ui/api/account';

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
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
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
        setError(err?.response?.data?.detail || 'Failed to load cohort.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadStats = (sitting) => {
    setStatsLoading(true);
    getCohortStats(id, sitting || undefined)
      .then(setStats)
      .catch(() => showToast('Failed to load stats.', 'error'))
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
      showToast('Search failed.', 'error');
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
      showToast(`${selectedIds.size} student(s) added.`, 'success');
      loadStats(sittingFilter);
    } catch {
      showToast('Failed to add students.', 'error');
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
      showToast('Student removed from cohort.', 'success');
      loadStats(sittingFilter);
    } catch {
      showToast('Failed to remove student.', 'error');
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
      <Link to="/cohorts" style={backLinkStyle}>← Back to Cohorts</Link>

      {loading && <LoadingSpinner label="Loading cohort…" />}
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
            <Button onClick={() => setAddModalOpen(true)}>Add Students</Button>
          </div>

          <div style={containerStyle}>
            {/* Members section */}
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>
                <span>Members ({cohort.members.length})</span>
              </div>
              {cohort.members.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No students yet. Click 'Add Students' to begin." />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Class</th>
                        <th style={thStyle}>Year</th>
                        <th style={thStyle}>Actions</th>
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
                              Remove
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
                <span>Subject Statistics</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="sitting-filter" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    Sitting:
                  </label>
                  <select
                    id="sitting-filter"
                    value={sittingFilter}
                    onChange={(e) => setSittingFilter(e.target.value)}
                    style={{ ...inputStyle, minWidth: '120px' }}
                  >
                    <option value="">All</option>
                    <option value="MOCK">MOCK</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="OFFICIAL">OFFICIAL</option>
                  </select>
                  {statsLoading && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Loading…</span>}
                </div>
              </div>

              {!stats || stats.subject_stats.length === 0 ? (
                <div style={{ padding: 'var(--space-5)' }}>
                  <EmptyState message="No grade data for this cohort yet." />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Subject Code</th>
                        <th style={thStyle}>Subject Name</th>
                        <th style={thStyle}>Sitting</th>
                        <th style={thStyle}>Students</th>
                        <th style={thStyle}>Mean Grade</th>
                        <th style={thStyle}>Variance</th>
                        <th style={thStyle}>Distribution</th>
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
        title="Add Students to Cohort"
        onClose={() => { setAddModalOpen(false); setSelectedIds(new Set()); setSearchResults([]); setSearchQuery(''); setSearchClass(''); setSearchYear(''); }}
        onConfirm={handleAddMembers}
        confirmLabel={adding ? 'Adding…' : `Add Selected (${selectedIds.size})`}
        confirmVariant="primary"
      >
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Name…"
              style={{ ...inputStyle, flex: '2 1 120px' }}
              aria-label="Search by name"
            />
            <input
              value={searchClass}
              onChange={(e) => setSearchClass(e.target.value)}
              placeholder="Class (e.g. 5A)"
              style={{ ...inputStyle, flex: '1 1 80px' }}
              aria-label="Filter by class"
            />
            <input
              value={searchYear}
              onChange={(e) => setSearchYear(e.target.value)}
              placeholder="Year"
              type="number"
              style={{ ...inputStyle, flex: '1 1 60px' }}
              aria-label="Filter by year"
            />
            <Button onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults.length === 0 && !searchLoading && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Showing all results. Type to filter.
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
                    {alreadyMember && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>already in cohort</span>}
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
        title="Remove Student"
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        confirmLabel={removing ? 'Removing…' : 'Remove'}
        confirmVariant="danger"
      >
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          Remove <strong>{removeTarget?.full_name}</strong> from this cohort? The student's data is not affected.
        </p>
      </Modal>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default CohortDetail;
