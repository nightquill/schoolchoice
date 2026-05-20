// REQ-088: Dashboard Page — cohort-centric
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@schoolchoice/ui/primitives/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@schoolchoice/ui/primitives/dialog';
import { Input } from '@schoolchoice/ui/primitives/input';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getStudents, createStudent } from '../../api/students';
import { getSubmissions } from '../../api/submissions';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getEntities, getEntityList } from '../../api/entities';
import { getCohorts, createCohort } from '../../api/cohorts';
import AlertsPanel from '../../components/AlertsPanel/AlertsPanel';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useFeatureAccess, useHasAnyAccess } from '../../hooks/usePermission';
import { Users } from 'lucide-react';

function Dashboard() {
  const { t } = useTranslation();
  const { canEdit: canImport } = useFeatureAccess('data_import');
  const { hasAccess, isLoading: accessLoading } = useHasAnyAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [cohortDesc, setCohortDesc] = useState('');

  // Config-driven: fetch entity registry for dynamic metrics
  const entitiesQuery = useQuery({ queryKey: ['entities'], queryFn: getEntities });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => getStudents({ limit: 500 }) });
  const submissionsQuery = useQuery({ queryKey: ['submissions'], queryFn: getSubmissions });
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const cohortsQuery = useQuery({ queryKey: ['cohorts'], queryFn: getCohorts });

  const students = Array.isArray(studentsQuery.data) ? studentsQuery.data : (studentsQuery.data?.items ?? []);
  const cohorts = cohortsQuery.data?.cohorts ?? [];

  // First-login redirect: only show onboarding for truly new users (no students yet)
  const studentsLoaded = studentsQuery.isSuccess;
  const studentCount = students.length || (studentsQuery.data?.total ?? 0);
  useEffect(() => {
    if (!studentsLoaded) return;
    const onboardingDone = localStorage.getItem('onboarding_complete');
    if (!onboardingDone) {
      if (studentCount === 0) {
        navigate('/onboarding', { replace: true });
      } else {
        localStorage.setItem('onboarding_complete', 'true');
      }
    }
  }, [navigate, studentsLoaded, studentCount]);
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

  // Derived counts
  const plansGenerated = loading ? null : students.filter((s) => s.has_plan).length;
  const plansMissing = loading ? null : students.filter((s) => !s.has_plan).length;
  const pendingSubmissions = submissionsQuery.isLoading ? null : (submissionsQuery.data?.submissions?.length ?? submissionsQuery.data?.total ?? 0);

  // Combine domain-specific + config-driven metrics
  const metrics = [
    { label: t('dashboard.totalStudents'), value: loading ? '--' : students.length, link: null },
    {
      label: t('dashboard.plansGenerated'),
      value: plansGenerated ?? '--',
      link: '/analytics/plans',
      alert: plansMissing && plansMissing > 0 ? `${plansMissing} ${t('dashboard.missingPlan')}` : null,
      alertColor: 'var(--color-warning)',
    },
    {
      label: t('submissions.pendingSubmissions'),
      value: pendingSubmissions ?? '--',
      link: '/submissions',
      alert: pendingSubmissions && pendingSubmissions > 0 ? `${pendingSubmissions} ${t('dashboard.awaitingReview')}` : null,
      alertColor: 'var(--color-primary)',
    },
    ...entityMetrics.map((m, i) => ({
      label: m.label,
      value: entityCountQueries[i]?.data?.length ?? '--',
      link: null,
    })),
  ];

  // Create cohort mutation
  const createCohortMutation = useMutation({
    mutationFn: (data) => createCohort(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      setShowCreateCohort(false);
      setCohortName('');
      setCohortDesc('');
    },
  });

  // Search students by name for quick-find
  const filteredStudents = searchQuery.trim()
    ? students.filter((s) => {
        const name = (s.full_name || s.name || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      })
    : [];

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) { setFormError(t('dashboard.nameRequired')); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const newStudent = await createStudent({ name: newName.trim() });
      setShowAddForm(false);
      setNewName('');
      navigate(`/students/${newStudent.id}/profile`);
    } catch {
      setFormError(t('dashboard.createFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateCohort = () => {
    if (!cohortName.trim()) return;
    createCohortMutation.mutate({
      name: cohortName.trim(),
      description: cohortDesc.trim() || null,
    });
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100dvh',
    fontFamily: 'var(--font-family-base)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      {!accessLoading && !hasAccess && account?.role === 'counsellor' ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)' }}>{t('permission.noGroupAccess')}</div>
      ) : (
      <>
      {/* Config-driven metrics: domain-specific + auto_crud entity counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 md:px-8" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)' }} role="region" aria-label="Summary statistics">
        {metrics.map((m) => {
          const card = (
            <Card style={m.link ? { cursor: 'pointer' } : undefined}>
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {m.value}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: 'var(--space-1)',
                  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
                  color: m.alert ? (m.alertColor || 'var(--color-warning)') : 'transparent',
                  minHeight: '1.2em',
                }}>
                  {m.alert || '\u00A0'}
                </span>
              </CardContent>
            </Card>
          );
          return m.link ? (
            <Link key={m.label} to={m.link} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link>
          ) : (
            <div key={m.label}>{card}</div>
          );
        })}
      </div>

      <AlertsPanel />

      <main id="main-content" className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        {/* Student data import section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(37,99,235,0.01) 100%)',
          border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
        }}>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-4)', background: 'var(--color-surface)',
                border: 'var(--border-width) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)', cursor: 'pointer',
                fontFamily: 'var(--font-family-base)', transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: '24px' }}>+</span>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{t('dashboard.addStudent')}</span>
            </button>
          )}
          <button
            onClick={() => canImport && navigate('/import/students')}
            disabled={!canImport}
            title={!canImport ? t('permission.requiresPermission', { permission: t('permission.dataImport') }) : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-4)', background: 'var(--color-surface)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)', cursor: !canImport ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-family-base)', transition: 'box-shadow 0.15s, border-color 0.15s',
              opacity: !canImport ? 0.5 : undefined,
            }}
            onMouseEnter={(e) => { if (canImport) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span style={{ fontSize: '24px' }}>&#8593;</span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{t('import.importCsvExcel')}</span>
          </button>
          <button
            onClick={async () => {
              try {
                const { default: client } = await import('@schoolchoice/ui/api/client');
                const resp = await client.get('/api/v1/entities/student/export', { responseType: 'blob' });
                const url = URL.createObjectURL(resp.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = `students-export-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { toast.error(t('dashboard.exportFailed')); }
            }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-4)', background: 'var(--color-surface)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)', cursor: 'pointer',
              fontFamily: 'var(--font-family-base)', transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span style={{ fontSize: '24px' }}>&#8595;</span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{t('dashboard.exportStudents')}</span>
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateStudent} style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label htmlFor="new-student-name" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                {t('dashboard.studentFullName')} <span style={{ color: 'var(--color-error)' }} aria-hidden="true">*</span>
              </label>
              <input
                autoFocus
                type="text"
                id="new-student-name"
                name="student_name"
                autoComplete="off"
                placeholder={t('dashboard.studentFullName')}
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setFormError(''); }}
                disabled={formLoading}
                style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)', border: `var(--border-width) solid ${formError ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)' }}
                aria-label="Student full name"
                aria-describedby={formError ? 'new-student-error' : undefined}
                aria-invalid={!!formError}
              />
              {formError && <span id="new-student-error" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>{formError}</span>}
            </div>
            <Button type="submit" disabled={formLoading}>{formLoading ? t('dashboard.creating') : t('dashboard.create')}</Button>
            <Button variant="secondary" onClick={() => { setShowAddForm(false); setNewName(''); setFormError(''); }} disabled={formLoading}>{t('dashboard.cancel')}</Button>
          </form>
        )}

        {loading && <LoadingSpinner label={t('dashboard.loadingStudents')} />}
        {error && <ErrorMessage message={error} />}

        {/* Cohort buttons — primary navigation */}
        {!loading && !error && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, textWrap: 'balance' }}>
                {t('dashboard.yourCohorts')}
              </h2>
              {(account?.can_manage_cohorts || account?.role === 'admin') && (
                <Button variant="secondary" onClick={() => setShowCreateCohort(true)}>
                  {t('dashboard.newCohort')}
                </Button>
              )}
            </div>

            {/* Search bar — finds students across all cohorts */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('dashboard.searchStudentByName')}
                name="student-search"
                autoComplete="off"
                style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                aria-label={t('dashboard.searchStudentByName')}
              />
              {searchQuery.trim() && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  {filteredStudents.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dashboard.noMatch')}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredStudents.slice(0, 12).map((student) => (
                        <div
                          key={student.id}
                          onClick={() => navigate(`/students/${student.id}/profile`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/students/${student.id}/profile`); } }}
                          style={{
                            background: 'var(--color-surface)',
                            border: 'var(--border-width) solid var(--color-border)',
                            borderRadius: 'var(--border-radius-md)',
                            padding: 'var(--space-3)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-1)',
                          }}
                        >
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                            {student.full_name || student.name || t('dashboard.unnamedStudent')}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {student.class_name && `${t('dashboard.class')} ${student.class_name}`}
                            {student.class_name && student.year_of_study && ' · '}
                            {student.year_of_study && `${t('dashboard.year')} ${student.year_of_study}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {cohortsQuery.isLoading && <LoadingSpinner label={t('cohorts.loading')} />}

            {!cohortsQuery.isLoading && cohorts.length === 0 && (
              <EmptyState message={t('dashboard.noCohorts')} />
            )}

            {!cohortsQuery.isLoading && cohorts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Cohort list">
                {[...cohorts].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)).map((cohort) => (
                  <Card
                    key={cohort.id}
                    role="listitem"
                    style={{
                      cursor: 'pointer', transition: 'box-shadow 0.15s',
                      ...(cohort.is_default ? { borderColor: 'var(--color-primary)', borderWidth: '2px' } : {}),
                    }}
                    onClick={() => navigate(`/cohorts/${cohort.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/cohorts/${cohort.id}`); } }}
                    tabIndex={0}
                  >
                    <CardHeader>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Users size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} aria-hidden="true" />
                        <CardTitle style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>
                          {cohort.name}
                        </CardTitle>
                        {cohort.is_default && (
                          <span style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-info-bg)', color: 'var(--color-primary)', padding: '1px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>
                            {t('dashboard.default')}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {cohort.description && !cohort.is_default && (
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                          {cohort.description}
                        </p>
                      )}
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {t('dashboard.studentsCount', { count: cohort.member_count })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      </>
      )}

      {/* Create cohort dialog */}
      <Dialog open={showCreateCohort} onOpenChange={setShowCreateCohort}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.createCohort')}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="cohort-name" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                {t('dashboard.cohortName')} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="cohort-name"
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder={t('dashboard.cohortNamePlaceholder')}
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="cohort-desc" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                {t('dashboard.cohortDescription')}
              </label>
              <Input
                id="cohort-desc"
                value={cohortDesc}
                onChange={(e) => setCohortDesc(e.target.value)}
                placeholder={t('dashboard.cohortDescPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateCohort(false)} disabled={createCohortMutation.isPending}>
              {t('dashboard.cancel')}
            </Button>
            <Button onClick={handleCreateCohort} disabled={createCohortMutation.isPending || !cohortName.trim()}>
              {createCohortMutation.isPending ? t('cohorts.creating') : t('dashboard.createCohort')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Dashboard;
