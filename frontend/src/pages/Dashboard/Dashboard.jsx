// REQ-088: Dashboard Page
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import { Button } from '@/components/ui/button';
import { getStudents, createStudent } from '../../api/students';
import { getAccount } from '../../api/account';

function Dashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    Promise.all([getStudents(), getAccount()])
      .then(([studentData, accountData]) => {
        setStudents(Array.isArray(studentData) ? studentData : (studentData.items ?? []));
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to load dashboard data.');
      })
      .finally(() => setLoading(false));
  }, []);

  const plansGenerated = students.filter((s) => s.has_plan).length;

  const filteredStudents = students.filter((s) => {
    const name = (s.full_name || s.name || '').toLowerCase();
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
    if (filterClass && s.class_name !== filterClass) return false;
    if (filterYear && String(s.year_of_study) !== filterYear) return false;
    return true;
  });

  const uniqueClasses = [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort();
  const uniqueYears = [...new Set(students.map((s) => s.year_of_study).filter(Boolean))].sort();

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) { setFormError('Student name is required.'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const newStudent = await createStudent({ name: newName.trim() });
      setShowAddForm(false);
      setNewName('');
      navigate(`/students/${newStudent.id}/profile`);
    } catch {
      setFormError('Could not create student. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const statsBarStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    display: 'flex',
    gap: 'var(--space-8)',
    alignItems: 'center',
  };

  const statBlockStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1)',
  };

  const statValueStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    lineHeight: 'var(--line-height-tight)',
  };

  const statLabelStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const contentStyle = {
    padding: 'var(--space-6) var(--space-8)',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 'var(--space-6)',
    marginTop: 'var(--space-6)',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-5)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  const cardNameStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const cardMetaStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    margin: 0,
  };

  const headerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-2)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <div style={statsBarStyle} role="region" aria-label="Summary statistics">
        <div style={statBlockStyle}>
          <span style={statValueStyle}>{loading ? '--' : students.length}</span>
          <span style={statLabelStyle}>Total Students</span>
        </div>
        <div style={statBlockStyle}>
          <span style={statValueStyle}>{loading ? '--' : plansGenerated}</span>
          <span style={statLabelStyle}>Plans Generated</span>
        </div>
        <div style={statBlockStyle}>
          <span style={statValueStyle}>--</span>
          <span style={statLabelStyle}>Active Targets</span>
        </div>
      </div>

      <main id="main-content" style={contentStyle}>
        <div style={headerRowStyle}>
          <h1 style={headingStyle}>Students</h1>
          {!showAddForm && (
            <Button
              variant="secondary"
              onClick={() => setShowAddForm(true)}
            >Add Student</Button>
          )}
        </div>

        {/* Search and filter bar */}
        {students.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name…"
              style={{ flex: '2 1 160px', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
              aria-label="Search students by name"
            />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              style={{ flex: '1 1 100px', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
              aria-label="Filter by class"
            >
              <option value="">All Classes</option>
              {uniqueClasses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{ flex: '1 1 100px', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
              aria-label="Filter by year"
            >
              <option value="">All Years</option>
              {uniqueYears.map((y) => <option key={y} value={String(y)}>Year {y}</option>)}
            </select>
            {(searchQuery || filterClass || filterYear) && (
              <button
                onClick={() => { setSearchQuery(''); setFilterClass(''); setFilterYear(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleCreateStudent} style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Student full name"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setFormError(''); }}
                disabled={formLoading}
                style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)', border: `var(--border-width) solid ${formError ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)' }}
                aria-label="Student full name"
              />
              {formError && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>{formError}</span>}
            </div>
            <Button type="submit" disabled={formLoading}>{formLoading ? 'Creating\u2026' : 'Create'}</Button>
            <Button variant="secondary" onClick={() => { setShowAddForm(false); setNewName(''); setFormError(''); }} disabled={formLoading}>Cancel</Button>
          </form>
        )}

        {loading && <LoadingSpinner label="Loading students..." />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && students.length === 0 && (
          <EmptyState message="No students yet. Add a student to get started." />
        )}
        {!loading && !error && students.length > 0 && filteredStudents.length === 0 && (
          <EmptyState message="No students match the current filters." />
        )}
        {!loading && !error && filteredStudents.length > 0 && (
          <div style={gridStyle} role="list" aria-label="Student cards">
            {filteredStudents.map((student) => (
              <div key={student.id} style={cardStyle} role="listitem">
                <p style={cardNameStyle}>{student.full_name || student.name || 'Unnamed Student'}</p>
                {(student.year_of_study || student.class_name) && (
                  <p style={cardMetaStyle}>
                    {student.class_name && `Class ${student.class_name}`}
                    {student.class_name && student.year_of_study && ' · '}
                    {student.year_of_study && `Year ${student.year_of_study}`}
                  </p>
                )}
                <p style={cardMetaStyle}>
                  Last plan:{' '}
                  {student.plan_generated_at
                    ? student.plan_generated_at.slice(0, 10)
                    : 'No plan yet'}
                </p>
                <Button
                  onClick={() => navigate(`/students/${student.id}/profile`)}
                >View Profile</Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
