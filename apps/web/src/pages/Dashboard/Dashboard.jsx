// REQ-088: Dashboard Page
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@schoolchoice/ui/primitives/card';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getStudents, createStudent } from '../../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getEntities, getEntityList } from '../../api/entities';
import AlertsPanel from '../../components/AlertsPanel/AlertsPanel';

function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const onboardingDone = localStorage.getItem('onboarding_complete');
    if (!onboardingDone) {
      navigate('/onboarding', { replace: true });
    }
  }, [navigate]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Config-driven: fetch entity registry for dynamic metrics
  const entitiesQuery = useQuery({ queryKey: ['entities'], queryFn: getEntities });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: getStudents });
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const students = Array.isArray(studentsQuery.data) ? studentsQuery.data : (studentsQuery.data?.items ?? []);
  const account = accountQuery.data ?? null;
  const loading = studentsQuery.isLoading || accountQuery.isLoading;
  const error = studentsQuery.error || accountQuery.error;

  // Build dynamic metrics from entity config (auto_crud entities)
  const entityMetrics = (entitiesQuery.data ?? [])
    .filter(e => e.auto_crud)
    .map(entity => ({
      label: entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
      queryKey: ['entities', entity.name, 'count'],
      queryFn: () => getEntityList(entity.table),
    }));

  const entityCountQueries = useQueries({
    queries: entityMetrics.map(m => ({
      queryKey: m.queryKey,
      queryFn: m.queryFn,
      enabled: !!entitiesQuery.data,
    })),
  });

  // Combine domain-specific + config-driven metrics
  const metrics = [
    { label: 'Total Students', value: loading ? '--' : students.length },
    { label: 'Plans Generated', value: loading ? '--' : students.filter((s) => s.has_plan).length },
    ...entityMetrics.map((m, i) => ({
      label: m.label,
      value: entityCountQueries[i]?.data?.length ?? '--',
    })),
  ];

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

  // (stats bar styles removed — now using Card-based config-driven metrics grid)

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

      {/* Config-driven metrics: domain-specific + auto_crud entity counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 md:px-8" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)' }} role="region" aria-label="Summary statistics">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                {m.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertsPanel />

      <main id="main-content" className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
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
            <Button type="submit" disabled={formLoading}>{formLoading ? 'Creating…' : 'Create'}</Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ marginTop: 'var(--space-6)' }} role="list" aria-label="Student cards">
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
                  className="w-full"
                  variant="outline"
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
