// Admin Management — two sections: Teachers (scope) + Cohorts (CRUD + members)
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@schoolchoice/ui/primitives/dialog';
import { Input } from '@schoolchoice/ui/primitives/input';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { listUsers, createUser, updateUser, getSubmissionRateLimit, setSubmissionRateLimit, getPlanDetailLevel, setPlanDetailLevel } from '../../api/admin';
import { getCohorts, createCohort, deleteCohort, getCohort, updateCohort, addCohortMembers, removeCohortMember, searchStudents } from '../../api/cohorts';
// Individual cohort permissions removed — use Teacher Groups for permission management
import { useTranslation } from '@schoolchoice/ui/i18n';
import { Users, BookOpen, Settings, Shield } from 'lucide-react';
import AdminTeacherGroups from '../AdminTeacherGroups/AdminTeacherGroups';

function AdminManage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('groups');

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount, staleTime: 5 * 60 * 1000 });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });
  const cohortsQuery = useQuery({ queryKey: ['cohorts'], queryFn: getCohorts });

  const account = accountQuery.data ?? null;
  const allUsers = usersQuery.data?.items ?? [];
  const cohorts = cohortsQuery.data?.cohorts ?? [];
  const teachers = allUsers.filter(u => u.role === 'counsellor' || u.role === 'admin');

  const sectionToggle = (id) => ({
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    background: activeSection === id ? 'var(--color-primary)' : 'none',
    color: activeSection === id ? '#fff' : 'var(--color-text-secondary)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
    fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)',
    fontWeight: activeSection === id ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
  });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />

      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
          {t('adminManage.title')}
        </h1>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <button onClick={() => setActiveSection('groups')} style={sectionToggle('groups')}>
            <Shield size={16} /> {t('teacherGroups.title')}
          </button>
          <button onClick={() => setActiveSection('cohorts')} style={sectionToggle('cohorts')}>
            <BookOpen size={16} /> {t('adminManage.cohortMgmt')}
          </button>
          <button onClick={() => setActiveSection('teachers')} style={sectionToggle('teachers')}>
            <Users size={16} /> {t('adminManage.teachers')}
          </button>
          <button onClick={() => setActiveSection('settings')} style={sectionToggle('settings')}>
            <Settings size={16} /> {t('adminManage.settings')}
          </button>
        </div>

        {activeSection === 'groups' && (
          <AdminTeacherGroups embedded />
        )}

        {activeSection === 'teachers' && (
          <TeachersSection
            teachers={teachers}
            account={account}
            usersLoading={usersQuery.isLoading}
            queryClient={queryClient}
            t={t}
          />
        )}

        {activeSection === 'cohorts' && (
          <CohortsSection
            cohorts={cohorts}
            cohortsLoading={cohortsQuery.isLoading}
            queryClient={queryClient}
            t={t}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsSection t={t} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS SECTION — simple user list with role management
// ═══════════════════════════════════════════════════════════════

function TeachersSection({ teachers, account, usersLoading, queryClient, t }) {
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState('counsellor');

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, ...data }) => updateUser(userId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(t('adminManage.saved')); },
    onError: () => toast.error(t('adminManage.saveFailed')),
  });

  const handleTeacherStatus = async (userId, newStatus) => {
    try {
      const { updateUserStatus } = await import('../../api/admin');
      await updateUserStatus(userId, newStatus);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t(`accountStatus.${newStatus}`));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('adminManage.saveFailed'));
    }
  };

  const [createdCredentials, setCreatedCredentials] = useState(null);

  const createUserMutation = useMutation({
    mutationFn: (data) => createUser(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreatedCredentials({ email: variables.email, password: variables.password });
      toast.success(t('settings.userCreated'));
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail;
      if (detail && detail.includes('exists')) toast.error(t('settings.emailExists'));
      else toast.error(t('settings.createFailed'));
    },
  });

  const cardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' };
  const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)' };
  const tdStyle = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)' };

  if (usersLoading) return <LoadingSpinner label={t('adminManage.loading')} />;

  return (
    <>
    <div style={cardStyle}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.teachersNote')}</span>
        <Button onClick={() => setShowCreateTeacher(true)}>{t('settings.createUser')}</Button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('adminManage.name')}</th>
              <th style={thStyle}>{t('adminManage.email')}</th>
              <th style={thStyle}>{t('adminManage.role')}</th>
              <th style={thStyle}>{t('studentList.account')}</th>
              <th style={thStyle}>{t('adminManage.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((user) => {
              const isSelf = account?.email === user.email;
              return (
                <tr key={user.id}>
                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)' }}>
                    {user.display_name || user.email.split('@')[0]}
                  </td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', fontWeight: 500,
                      background: user.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                      color: user.role === 'admin' ? '#1d4ed8' : '#6b7280',
                    }}>
                      {user.role === 'admin' ? t('adminManage.admin') : t('adminManage.counsellor')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', fontWeight: 500,
                      background: (user.account_status || 'active') === 'active' ? '#dcfce7' :
                                  (user.account_status || 'active') === 'suspended' ? '#fef3c7' : '#f3f4f6',
                      color: (user.account_status || 'active') === 'active' ? '#166534' :
                             (user.account_status || 'active') === 'suspended' ? '#92400e' : '#6b7280',
                    }}>
                      {t(`accountStatus.${user.account_status || 'active'}`)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {!isSelf && (() => {
                      const userStatus = user.account_status || 'active';
                      return (
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
                          {userStatus === 'active' && (
                            <select
                              value={user.role}
                              onChange={(e) => updateUserMutation.mutate({ userId: user.id, role: e.target.value })}
                              disabled={updateUserMutation.isPending}
                              style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)' }}
                            >
                              <option value="counsellor">{t('adminManage.counsellor')}</option>
                              <option value="admin">{t('adminManage.admin')}</option>
                            </select>
                          )}
                          {userStatus === 'active' && (
                            <>
                              <button onClick={() => handleTeacherStatus(user.id, 'suspended')}
                                style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
                                {t('accountStatus.suspend')}
                              </button>
                              <button onClick={() => handleTeacherStatus(user.id, 'archived')}
                                style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
                                {t('accountStatus.archive')}
                              </button>
                            </>
                          )}
                          {(userStatus === 'suspended' || userStatus === 'archived') && (
                            <button onClick={() => handleTeacherStatus(user.id, 'active')}
                              style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-primary)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', color: 'var(--color-primary)', fontFamily: 'var(--font-family-base)' }}>
                              {t('accountStatus.reactivate')}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <Dialog open={showCreateTeacher} onOpenChange={(open) => { if (!open) { setShowCreateTeacher(false); setCreatedCredentials(null); setNewEmail(''); setNewPassword(''); setNewDisplayName(''); setNewRole('counsellor'); } else { setShowCreateTeacher(true); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{createdCredentials ? t('settings.userCreated') : t('settings.createUser')}</DialogTitle></DialogHeader>
        {!createdCredentials ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('adminManage.email')} *</label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="teacher@school.hk" type="email" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('settings.password')} *</label>
                <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('settings.fullName')}</label>
                <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('adminManage.role')}</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>
                  <option value="counsellor">{t('adminManage.counsellor')}</option>
                  <option value="admin">{t('adminManage.admin')}</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowCreateTeacher(false)}>{t('dashboard.cancel')}</Button>
              <Button onClick={() => createUserMutation.mutate({ email: newEmail.trim(), password: newPassword, display_name: newDisplayName.trim() || null, role: newRole })} disabled={!newEmail.trim() || !newPassword || createUserMutation.isPending}>
                {createUserMutation.isPending ? t('settings.saving') : t('settings.createUser')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--color-background)', padding: 'var(--space-4)', borderRadius: 'var(--border-radius-md)', marginBottom: 'var(--space-4)' }}>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.email')}: </span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{createdCredentials.email}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('settings.password')}: </span>
                <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{createdCredentials.password}</strong>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { sendCredentialsEmail } = await import('../../api/invite');
                    await sendCredentialsEmail(
                      createdCredentials.email,
                      createdCredentials.email,
                      createdCredentials.password,
                      newDisplayName || createdCredentials.email.split('@')[0],
                    );
                    toast.success(t('studentList.emailSent'));
                  } catch {
                    toast.error(t('studentList.emailFailed'));
                  }
                }}
              >
                {t('studentList.sendViaEmail')}
              </Button>
              <Button onClick={() => { setShowCreateTeacher(false); setCreatedCredentials(null); setNewEmail(''); setNewPassword(''); setNewDisplayName(''); setNewRole('counsellor'); }}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// COHORTS SECTION — CRUD + member management
// ═══════════════════════════════════════════════════════════════

function CohortsSection({ cohorts, cohortsLoading, queryClient, t }) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [cohortDesc, setCohortDesc] = useState('');
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState('');

  // Auto-select first cohort
  useEffect(() => {
    if (!selectedCohort && cohorts.length > 0) setSelectedCohort(cohorts[0]);
  }, [cohorts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cohort detail when selected
  const cohortDetailQuery = useQuery({
    queryKey: ['cohort-detail', selectedCohort?.id],
    queryFn: () => getCohort(selectedCohort.id),
    enabled: !!selectedCohort?.id,
  });
  const cohortDetail = cohortDetailQuery.data;

  const createMutation = useMutation({
    mutationFn: (data) => createCohort(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      setShowCreate(false); setCohortName(''); setCohortDesc('');
      toast.success(t('adminManage.cohortCreated'));
    },
    onError: () => toast.error(t('adminManage.cohortCreateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCohort(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      setDeleteTarget(null);
      if (selectedCohort?.id === deleteTarget?.id) setSelectedCohort(null);
      toast.success(t('adminManage.cohortDeleted'));
    },
    onError: () => toast.error(t('adminManage.cohortDeleteFailed')),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => updateCohort(id, { name }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      queryClient.invalidateQueries({ queryKey: ['cohort-detail', renameTarget?.id] });
      // Update selectedCohort in-place
      if (selectedCohort?.id === renameTarget?.id) {
        setSelectedCohort({ ...selectedCohort, name: renameName.trim() });
      }
      setRenameTarget(null);
      setRenameName('');
      toast.success(t('adminManage.cohortRenamed'));
    },
    onError: () => toast.error(t('adminManage.cohortRenameFailed')),
  });

  const addMembersMutation = useMutation({
    mutationFn: ({ cohortId, studentIds }) => addCohortMembers(cohortId, studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-detail', selectedCohort?.id] });
      setAddModalOpen(false); setSelectedIds(new Set()); setSearchResults([]);
      toast.success(t('cohortDetail.addSuccess', { count: selectedIds.size }));
    },
    onError: () => toast.error(t('cohortDetail.addFailed')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ cohortId, studentId }) => removeCohortMember(cohortId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-detail', selectedCohort?.id] });
      toast.success(t('cohortDetail.removeSuccess'));
    },
    onError: () => toast.error(t('cohortDetail.removeFailed')),
  });

  const handleSearch = async () => {
    setSearchLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      const result = await searchStudents(params);
      setSearchResults(result.students ?? []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  };

  const toggleSelect = (sid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const cardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' };
  const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)' };
  const tdStyle = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)' };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
      {/* Left: Cohort list */}
      <div style={{ flex: '1 1 280px', minWidth: '260px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
            {t('adminManage.cohortCount', { count: cohorts.length })}
          </span>
          <Button variant="secondary" onClick={() => setShowCreate(true)}>{t('adminManage.createCohort')}</Button>
        </div>

        {cohortsLoading ? <LoadingSpinner label={t('adminManage.loading')} /> : (
          <div style={{ ...cardStyle, maxHeight: '70vh', overflowY: 'auto' }}>
            {cohorts.map((c) => {
              const isSelected = selectedCohort?.id === c.id;
              return (
                <div key={c.id} onClick={() => setSelectedCohort(c)} style={{
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--color-surface)',
                  borderBottom: 'var(--border-width) solid var(--color-border)',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedCohort(c)}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {c.name}
                      <span style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '6px',
                        background: '#dbeafe', color: '#1d4ed8', fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>{t('adminManage.studentCohort')}</span>
                    </div>
                    {c.description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{c.description}</div>}
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {t('cohorts.studentCount', { count: c.member_count })}
                  </span>
                </div>
              );
            })}
            {cohorts.length === 0 && <p style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.noCohorts')}</p>}
          </div>
        )}
      </div>

      {/* Right: Cohort detail */}
      <div style={{ flex: '2 1 400px', minWidth: '340px' }}>
        {!selectedCohort ? (
          <div style={{ ...cardStyle, padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.selectCohortDetail')}</p>
          </div>
        ) : (
          <div>
            {/* Cohort header */}
            <div style={{ ...cardStyle, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>{selectedCohort.name}</h2>
                  {selectedCohort.description && <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>{selectedCohort.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="secondary" onClick={() => setAddModalOpen(true)}>{t('cohortDetail.addStudents')}</Button>
                  <Button variant="outline" onClick={() => navigate(`/cohorts/${selectedCohort.id}`)}>{t('adminManage.viewFull')}</Button>
                  {!selectedCohort.is_default && (
                    <Button variant="outline" onClick={() => { setRenameTarget(selectedCohort); setRenameName(selectedCohort.name); }}>{t('common.edit')}</Button>
                  )}
                  {!selectedCohort.is_default && (
                    <button onClick={() => setDeleteTarget(selectedCohort)} style={{
                      background: 'none', border: 'var(--border-width) solid var(--color-error)',
                      borderRadius: 'var(--border-radius-sm)', color: 'var(--color-error)',
                      fontSize: 'var(--font-size-sm)', padding: 'var(--space-1) var(--space-3)', cursor: 'pointer', fontFamily: 'var(--font-family-base)',
                    }}>{t('common.delete')}</button>
                  )}
                </div>
              </div>
            </div>

            {/* Members list */}
            <div style={cardStyle}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {t('cohortDetail.members')} ({cohortDetail?.members?.length ?? '…'})
              </div>
              {cohortDetailQuery.isLoading ? (
                <div style={{ padding: 'var(--space-4)' }}><LoadingSpinner label={t('adminManage.loading')} /></div>
              ) : !cohortDetail?.members?.length ? (
                <p style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('cohortDetail.noStudents')}</p>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={thStyle}>{t('cohortDetail.name')}</th>
                      <th style={thStyle}>{t('cohortDetail.class')}</th>
                      <th style={thStyle}>{t('cohortDetail.year')}</th>
                      <th style={thStyle}>{t('adminManage.actions')}</th>
                    </tr></thead>
                    <tbody>
                      {cohortDetail.members.map((m) => (
                        <tr key={m.id}>
                          <td style={tdStyle}>
                            <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => navigate(`/students/${m.id}/profile`)}>
                              {m.full_name}
                            </span>
                          </td>
                          <td style={tdStyle}>{m.class_name || '—'}</td>
                          <td style={tdStyle}>{m.year_of_study ?? '—'}</td>
                          <td style={tdStyle}>
                            <button onClick={() => removeMemberMutation.mutate({ cohortId: selectedCohort.id, studentId: m.id })} disabled={removeMemberMutation.isPending} style={{
                              background: 'none', border: 'var(--border-width) solid var(--color-error)',
                              borderRadius: 'var(--border-radius-sm)', color: 'var(--color-error)',
                              fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', fontFamily: 'var(--font-family-base)',
                            }}>{t('cohortDetail.remove')}</button>
                          </td>
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

      {/* Create cohort dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('adminManage.createCohort')}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('dashboard.cohortName')} *</label>
              <Input value={cohortName} onChange={(e) => setCohortName(e.target.value)} placeholder={t('dashboard.cohortNamePlaceholder')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('dashboard.cohortDescription')}</label>
              <Input value={cohortDesc} onChange={(e) => setCohortDesc(e.target.value)} placeholder={t('dashboard.cohortDescPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{t('dashboard.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ name: cohortName.trim(), description: cohortDesc.trim() || null })} disabled={!cohortName.trim() || createMutation.isPending}>
              {createMutation.isPending ? t('cohorts.creating') : t('adminManage.createCohort')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete cohort dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('cohorts.deleteCohort')}</DialogTitle></DialogHeader>
          <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
            {t('cohorts.deleteConfirm', { name: deleteTarget?.name })}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('dashboard.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t('cohorts.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename cohort dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('adminManage.renameCohort')}</DialogTitle></DialogHeader>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('adminManage.newCohortName')}</label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && renameName.trim() && renameMutation.mutate({ id: renameTarget.id, name: renameName.trim() })} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>{t('dashboard.cancel')}</Button>
            <Button onClick={() => renameMutation.mutate({ id: renameTarget.id, name: renameName.trim() })} disabled={!renameName.trim() || renameMutation.isPending}>
              {renameMutation.isPending ? t('profile.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add students dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('cohortDetail.addStudentsTitle')}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={t('cohortDetail.namePlaceholder')} />
            <Button onClick={handleSearch} disabled={searchLoading}>{searchLoading ? t('schools.searching') : t('cohortDetail.searchBtn')}</Button>
          </div>
          {searchResults.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '260px', overflowY: 'auto' }}>
              {searchResults.map((s) => {
                const alreadyMember = cohortDetail?.members?.some((m) => m.id === s.id);
                const selected = selectedIds.has(s.id);
                return (
                  <li key={s.id} onClick={() => !alreadyMember && toggleSelect(s.id)} style={{
                    padding: 'var(--space-2) var(--space-3)', cursor: alreadyMember ? 'default' : 'pointer',
                    background: selected ? 'rgba(37,99,235,0.08)' : 'transparent',
                    border: selected ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                    borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)',
                    color: alreadyMember ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                    marginBottom: 'var(--space-1)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{s.full_name} {s.class_name && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>{s.class_name}</span>}</span>
                    {alreadyMember && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('cohortDetail.alreadyInCohort')}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setAddModalOpen(false); setSelectedIds(new Set()); setSearchResults([]); }}>{t('dashboard.cancel')}</Button>
            <Button onClick={() => addMembersMutation.mutate({ cohortId: selectedCohort.id, studentIds: [...selectedIds] })} disabled={selectedIds.size === 0 || addMembersMutation.isPending}>
              {addMembersMutation.isPending ? t('cohortDetail.addingLabel') : t('cohortDetail.addSelectedLabel', { count: selectedIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS SECTION
// ═══════════════════════════════════════════════════════════════

function SettingsSection({ t }) {
  const [rateLimit, setRateLimit] = useState(3);
  const [saving, setSaving] = useState(false);
  const [detailLevel, setDetailLevel] = useState('A');
  const [savingLevel, setSavingLevel] = useState(false);

  const rateLimitQuery = useQuery({
    queryKey: ['admin-submission-rate-limit'],
    queryFn: getSubmissionRateLimit,
  });

  const detailLevelQuery = useQuery({
    queryKey: ['admin-plan-detail-level'],
    queryFn: getPlanDetailLevel,
  });

  useEffect(() => {
    if (rateLimitQuery.data?.rate_limit != null) {
      setRateLimit(rateLimitQuery.data.rate_limit);
    }
  }, [rateLimitQuery.data]);

  useEffect(() => {
    if (detailLevelQuery.data?.level) {
      setDetailLevel(detailLevelQuery.data.level);
    }
  }, [detailLevelQuery.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSubmissionRateLimit(rateLimit);
      toast.success(t('adminManage.settingsSaved'));
    } catch {
      toast.error(t('adminManage.settingsFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLevel = async () => {
    setSavingLevel(true);
    try {
      await setPlanDetailLevel(detailLevel);
      toast.success(t('adminManage.settingsSaved'));
    } catch {
      toast.error(t('adminManage.settingsFailed'));
    } finally {
      setSavingLevel(false);
    }
  };

  const radioStyle = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' };

  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
        {t('adminManage.settings')}
      </h2>

      <div style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', maxWidth: '480px', marginBottom: 'var(--space-4)' }}>
        <label htmlFor="submission-rate" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {t('adminManage.submissionRateLimit')}
        </label>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3) 0' }}>
          {t('adminManage.submissionRateDesc')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Input
            id="submission-rate"
            type="number"
            min={1}
            max={50}
            value={rateLimit}
            onChange={(e) => setRateLimit(parseInt(e.target.value, 10) || 1)}
            style={{ width: '80px' }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('adminManage.perStudentPerDay')}
          </span>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('profile.saving') : t('targets.save')}
          </Button>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', maxWidth: '480px' }}>
        <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {t('adminManage.planDetailLevel')}
        </label>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3) 0' }}>
          {t('adminManage.planDetailDesc')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <label style={radioStyle}>
            <input type="radio" name="plan-detail-level" value="A" checked={detailLevel === 'A'} onChange={() => setDetailLevel('A')} />
            {t('adminManage.bandAOnly')}
          </label>
          <label style={radioStyle}>
            <input type="radio" name="plan-detail-level" value="B" checked={detailLevel === 'B'} onChange={() => setDetailLevel('B')} />
            {t('adminManage.bandAB')}
          </label>
          <label style={radioStyle}>
            <input type="radio" name="plan-detail-level" value="C" checked={detailLevel === 'C'} onChange={() => setDetailLevel('C')} />
            {t('adminManage.bandABC')}
          </label>
        </div>
        <Button onClick={handleSaveLevel} disabled={savingLevel}>
          {savingLevel ? t('profile.saving') : t('targets.save')}
        </Button>
      </div>
    </div>
  );
}

export default AdminManage;
