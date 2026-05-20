// REQ-032: Student Profile Management - Student list with search, import/export
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, LoadingSpinner, ErrorMessage } from '@schoolchoice/ui';
import { Input } from '@schoolchoice/ui/primitives/input';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import StudentRow from '../../components/StudentRow/StudentRow';
import StudentForm from '../../components/StudentForm/StudentForm';
import StudentFilterBar from '../../components/StudentFilterBar/StudentFilterBar';
import { getStudents, createStudent, deleteStudent, getDeletePreview } from '../../api/students';
import { updateUserStatus } from '../../api/admin';
import { inviteStudent, sendCredentialsEmail } from '../../api/invite';
import { assignAccount, bulkAssignAccounts } from '../../api/accountAssignment';
import { getCohorts, addCohortMembers } from '../../api/cohorts';
import { getAccount } from '@schoolchoice/ui/api/account';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useFeatureAccess } from '../../hooks/usePermission';

function StudentListPage() {
  const { t } = useTranslation();
  const { canEdit: canDelete } = useFeatureAccess('student_delete');
  const { canEdit: canInvite } = useFeatureAccess('account_assignment');
  const { canEdit: canImport } = useFeatureAccess('data_import');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [account, setAccount] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignUsername, setAssignUsername] = useState('');
  const [assignResult, setAssignResult] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({});
  const [debouncedFilters, setDebouncedFilters] = useState({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Batch assign accounts
  const [batchAssignLoading, setBatchAssignLoading] = useState(false);
  const [batchAssignResults, setBatchAssignResults] = useState(null);

  // Add-to-cohort modal
  const [showCohortModal, setShowCohortModal] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [cohortAddLoading, setCohortAddLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { getAccount().then(setAccount).catch(() => {}); }, []);

  // Debounce text search (q) by 300ms, pass other filters instantly
  useEffect(() => {
    const { q, ...rest } = filters;
    const handle = setTimeout(() => {
      setDebouncedFilters({ ...rest, q });
    }, q !== debouncedFilters.q ? 300 : 0);
    return () => clearTimeout(handle);
  }, [filters]);

  const studentsQuery = useQuery({
    queryKey: ['students', debouncedFilters],
    queryFn: () => {
      const params = {};
      if (debouncedFilters.q) params.q = debouncedFilters.q;
      if (debouncedFilters.unaccounted) params.unaccounted = true;
      if (debouncedFilters.class_name) params.class_name = debouncedFilters.class_name;
      if (debouncedFilters.year_of_study != null) params.year_of_study = debouncedFilters.year_of_study;
      if (debouncedFilters.subject_code) params.subject_code = debouncedFilters.subject_code;
      if (debouncedFilters.best5_min != null) params.best5_min = debouncedFilters.best5_min;
      if (debouncedFilters.best5_max != null) params.best5_max = debouncedFilters.best5_max;
      return getStudents(params);
    },
  });

  const students = Array.isArray(studentsQuery.data)
    ? studentsQuery.data
    : (studentsQuery.data?.items ?? []);

  // Derive class and year options from current student list
  const classOptions = useMemo(() => {
    const classes = new Set();
    students.forEach((s) => { if (s.class_name) classes.add(s.class_name); });
    return [...classes].sort();
  }, [students]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    students.forEach((s) => { if (s.year_of_study) years.add(s.year_of_study); });
    return [...years].sort((a, b) => a - b);
  }, [students]);

  // Cohorts for batch action
  const cohortsQuery = useQuery({
    queryKey: ['cohorts'],
    queryFn: getCohorts,
    enabled: showCohortModal,
  });
  const cohorts = cohortsQuery.data?.cohorts ?? [];

  const handleCreateStudent = async (formData) => {
    setFormLoading(true);
    setFormError('');
    try {
      await createStudent(formData);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t('studentList.addSuccess'));
    } catch {
      setFormError(t('studentList.addFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleAssignAccount = async () => {
    setAssignLoading(true);
    try {
      const result = await assignAccount(assignTarget.id, assignUsername || null);
      setAssignResult(result);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t('studentList.accountCreated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to assign account');
    } finally {
      setAssignLoading(false);
    }
  };

  const closeAssignModal = () => {
    setAssignTarget(null);
    setAssignUsername('');
    setAssignResult(null);
  };

  const handleBatchAssign = async () => {
    // Filter to only students without accounts
    const unassigned = students.filter((s) => selectedIds.has(s.id) && !s.has_account);
    if (unassigned.length === 0) {
      toast.error('All selected students already have accounts');
      return;
    }
    setBatchAssignLoading(true);
    try {
      const result = await bulkAssignAccounts(unassigned.map((s) => s.id));
      setBatchAssignResults(result);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      if (result.results?.length) {
        toast.success(t('studentList.batchAssignSuccess').replace('{count}', result.results.length));
      }
      if (result.errors?.length) {
        toast.error(t('studentList.batchAssignErrors').replace('{count}', result.errors.length));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to assign accounts');
    } finally {
      setBatchAssignLoading(false);
    }
  };

  const closeBatchResults = () => {
    setBatchAssignResults(null);
    setSelectedIds(new Set());
  };

  const copyAllCredentials = () => {
    if (!batchAssignResults?.results) return;
    const text = batchAssignResults.results.map((r) =>
      `${r.email}\t${r.password}`
    ).join('\n');
    navigator.clipboard?.writeText(text);
    toast.success(t('studentList.copiedToClipboard'));
  };

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleAddToCohort = async () => {
    if (!selectedCohortId || selectedIds.size === 0) return;
    setCohortAddLoading(true);
    try {
      await addCohortMembers(selectedCohortId, [...selectedIds]);
      toast.success(`${selectedIds.size} student(s) added to cohort`);
      setShowCohortModal(false);
      setSelectedIds(new Set());
      setSelectedCohortId('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add to cohort');
    } finally {
      setCohortAddLoading(false);
    }
  };

  const handleDeleteWithPreview = async (studentId) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    try {
      const preview = await getDeletePreview(studentId);
      setDeleteTarget(student);
      setDeletePreview(preview);
    } catch {
      toast.error(t('studentList.deleteFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteStudent(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t('studentList.deleteSuccess'));
      setDeleteTarget(null);
      setDeletePreview(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('studentList.deleteFailed'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (student, newStatus) => {
    if (!student.user_id) return;
    try {
      await updateUserStatus(student.user_id, newStatus);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t(`account.${newStatus}`));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('adminManage.saveFailed'));
    }
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '' && v !== false);

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const headerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 'var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    marginBottom: 'var(--space-6)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    background: 'var(--color-background)',
    fontWeight: 'var(--font-weight-medium)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const colSpan = 7; // checkbox + name + class + candidate_no + best5 + account + arrow

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <div className="px-4 md:px-8" style={{ maxWidth: '100%', margin: '0 auto', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div style={headerRowStyle}>
          <h1 style={headingStyle}>{t('studentList.title')}</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>{t('studentList.addStudent')}</Button>
          )}
        </div>

        <StudentFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          classOptions={classOptions}
          yearOptions={yearOptions}
        />

        {/* Batch action bar */}
        {(selectedIds.size > 0 || hasActiveFilters) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-background)',
            borderRadius: 'var(--border-radius-sm)',
            border: 'var(--border-width) solid var(--color-border)',
            fontSize: 'var(--font-size-sm)',
          }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {students.length} {t('filters.results')} · {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={selectAll}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-base)', textDecoration: 'underline',
              }}
            >
              {selectedIds.size === students.length ? 'Deselect All' : t('filters.selectAll')}
            </button>
            {selectedIds.size > 0 && (
              <>
                {canInvite && (
                  <Button
                    onClick={handleBatchAssign}
                    disabled={batchAssignLoading}
                    style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}
                  >
                    {batchAssignLoading ? '...' : t('studentList.batchAssignAccounts')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowCohortModal(true)}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}
                >
                  {t('filters.addToCohort')}
                </Button>
                {canDelete && account?.role === 'admin' && (() => {
                  const allNoAccount = [...selectedIds].every((sid) => {
                    const s = students.find((st) => st.id === sid);
                    return s && !s.has_account;
                  });
                  return allNoAccount ? (
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (window.confirm(t('account.batchDeleteConfirm', { count: selectedIds.size }))) {
                          for (const sid of selectedIds) {
                            try { await deleteStudent(sid); } catch {}
                          }
                          queryClient.invalidateQueries({ queryKey: ['students'] });
                          setSelectedIds(new Set());
                          toast.success(t('studentList.deleteSuccess'));
                        }
                      }}
                      style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}
                    >
                      {t('account.deleteSelected')}
                    </Button>
                  ) : null;
                })()}
              </>
            )}
          </div>
        )}

        {showForm && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            {formError && <ErrorMessage message={formError} />}
            <StudentForm
              onSubmit={handleCreateStudent}
              onCancel={() => { setShowForm(false); setFormError(''); }}
              loading={formLoading}
              submitLabel={t('common.save')}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th scope="col" style={{ ...thStyle, width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={students.length > 0 && selectedIds.size === students.length}
                    onChange={selectAll}
                    aria-label={t('filters.selectAll')}
                  />
                </th>
                <th scope="col" style={thStyle}>{t('common.name')}</th>
                <th scope="col" style={thStyle}>{t('studentList.class')}</th>
                <th scope="col" style={thStyle}>{t('studentList.candidateNumber')}</th>
                <th scope="col" style={thStyle}>{t('filters.best5')}</th>
                <th scope="col" style={thStyle}>{t('studentList.account')}</th>
                <th scope="col" style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {studentsQuery.isLoading ? (
                <tr>
                  <td colSpan={colSpan}>
                    <LoadingSpinner label={t('studentList.loading')} />
                  </td>
                </tr>
              ) : studentsQuery.isError ? (
                <tr>
                  <td colSpan={colSpan}>
                    <ErrorMessage message={t('studentList.loadFailed')} />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={colSpan}>
                    <EmptyState
                      message={
                        hasActiveFilters
                          ? t('studentList.noSearchResults')
                          : t('studentList.emptyState')
                      }
                    />
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    selected={selectedIds.has(student.id)}
                    onToggleSelect={toggleSelect}
                    onInvite={canInvite ? inviteStudent : undefined}
                    onAssignAccount={canInvite ? setAssignTarget : undefined}
                    onDelete={canDelete && account?.role === 'admin' ? handleDeleteWithPreview : undefined}
                    canDelete={canDelete && account?.role === 'admin'}
                    onStatusChange={account?.role === 'admin' ? handleStatusChange : undefined}
                    queryClient={queryClient}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Account Modal */}
      {assignTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={closeAssignModal}
        >
          <div
            style={{
              background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)',
              padding: 'var(--space-6)', minWidth: 360, maxWidth: 480,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {t('studentList.assignAccountTitle')}
            </h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {assignTarget.name}
            </p>

            {!assignResult ? (
              <>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('studentList.customUsername')}
                </label>
                <Input
                  type="text"
                  value={assignUsername}
                  onChange={(e) => setAssignUsername(e.target.value)}
                  placeholder={t('studentList.leaveBlankAuto')}
                  style={{ width: '100%', marginBottom: 'var(--space-4)' }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={closeAssignModal}>{t('common.cancel')}</Button>
                  <Button onClick={handleAssignAccount} disabled={assignLoading}>
                    {assignLoading ? '...' : t('common.confirm')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--color-background)', padding: 'var(--space-4)', borderRadius: 'var(--border-radius-md)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('studentList.generatedUsername')}: </span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{assignResult.email}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('studentList.generatedPassword')}: </span>
                    <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{assignResult.password}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  {assignTarget?.email && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await sendCredentialsEmail(
                            assignTarget.email,
                            assignResult.email,
                            assignResult.password,
                            assignTarget.name,
                          );
                          toast.success(t('studentList.emailSent'));
                        } catch {
                          toast.error(t('studentList.emailFailed'));
                        }
                      }}
                    >
                      {t('studentList.sendViaEmail')}
                    </Button>
                  )}
                  <Button onClick={closeAssignModal}>{t('common.close')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch Assign Results Modal */}
      {batchAssignResults && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={closeBatchResults}
        >
          <div
            style={{
              background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)',
              padding: 'var(--space-6)', minWidth: 480, maxWidth: 640, maxHeight: '80vh', overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {t('studentList.batchResultTitle')}
            </h2>

            {batchAssignResults.results?.length > 0 && (
              <>
                <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-success, #16a34a)', fontWeight: 'var(--font-weight-medium)' }}>
                  {t('studentList.batchAssignSuccess').replace('{count}', batchAssignResults.results.length)}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('studentList.batchResultEmail')}</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('studentList.batchResultPassword')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchAssignResults.results.map((r) => (
                      <tr key={r.student_id}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>{r.email}</td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace' }}>{r.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button variant="outline" onClick={copyAllCredentials} style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  {t('studentList.copyAll')}
                </Button>
              </>
            )}

            {batchAssignResults.errors?.length > 0 && (
              <>
                <p style={{ margin: 'var(--space-2) 0', fontSize: 'var(--font-size-sm)', color: '#dc2626', fontWeight: 'var(--font-weight-medium)' }}>
                  {t('studentList.batchAssignErrors').replace('{count}', batchAssignResults.errors.length)}
                </p>
                <ul style={{ margin: '0 0 var(--space-4)', padding: '0 0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {batchAssignResults.errors.map((e, i) => (
                    <li key={i}>{e.student_id}: {e.error}</li>
                  ))}
                </ul>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={closeBatchResults}>{t('common.close')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && deletePreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setDeleteTarget(null); setDeletePreview(null); }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)', padding: 'var(--space-6)', minWidth: 360, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {t('account.deleteConfirmTitle', { name: deleteTarget.name || deleteTarget.full_name })}
            </h2>
            {(deletePreview.grades > 0 || deletePreview.targets > 0 || deletePreview.plans > 0 || deletePreview.submissions > 0) && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('account.cascadeWarning')}
                </p>
                <ul style={{ margin: 0, padding: '0 0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {deletePreview.grades > 0 && <li>{t('account.gradeRecords', { count: deletePreview.grades })}</li>}
                  {deletePreview.targets > 0 && <li>{t('account.targets', { count: deletePreview.targets })}</li>}
                  {deletePreview.plans > 0 && <li>{t('account.academicPlans', { count: deletePreview.plans })}</li>}
                  {deletePreview.submissions > 0 && <li>{t('account.submissions', { count: deletePreview.submissions })}</li>}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeletePreview(null); }}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? '...' : t('account.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Cohort Modal */}
      {showCohortModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowCohortModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)',
              padding: 'var(--space-6)', minWidth: 360, maxWidth: 480,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {t('filters.addToCohort')}
            </h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {selectedIds.size} {t('filters.students')} selected
            </p>
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', marginBottom: 'var(--space-4)',
                borderRadius: 'var(--border-radius-sm)',
                border: 'var(--border-width) solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-base)',
              }}
            >
              <option value="">Select cohort...</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setShowCohortModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddToCohort} disabled={!selectedCohortId || cohortAddLoading}>
                {cohortAddLoading ? '...' : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentListPage;
