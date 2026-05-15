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
import { listUsers, updateUser, getSubmissionRateLimit, setSubmissionRateLimit, getPlanDetailLevel, setPlanDetailLevel } from '../../api/admin';
import { getCohorts, createCohort, deleteCohort, getCohort, addCohortMembers, removeCohortMember, searchStudents } from '../../api/cohorts';
import { getCohortPermissions, setCohortPermission, removeCohortPermission } from '../../api/admin';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { Users, BookOpen, Settings } from 'lucide-react';

function AdminManage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('teachers');

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
          <button onClick={() => setActiveSection('teachers')} style={sectionToggle('teachers')}>
            <Users size={16} /> {t('adminManage.teachers')}
          </button>
          <button onClick={() => setActiveSection('cohorts')} style={sectionToggle('cohorts')}>
            <BookOpen size={16} /> {t('adminManage.cohortMgmt')}
          </button>
          <button onClick={() => setActiveSection('settings')} style={sectionToggle('settings')}>
            <Settings size={16} /> {t('adminManage.settings')}
          </button>
        </div>

        {activeSection === 'teachers' && (
          <TeachersSection
            teachers={teachers}
            cohorts={cohorts}
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
// TEACHERS SECTION
// ═══════════════════════════════════════════════════════════════

function TeachersSection({ teachers, cohorts, account, usersLoading, queryClient, t }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [grantCohortId, setGrantCohortId] = useState('');
  const [grantPermission, setGrantPermission] = useState('read_write');

  useEffect(() => {
    if (!selectedUser && teachers.length > 0) setSelectedUser(teachers[0]);
  }, [teachers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, ...data }) => updateUser(userId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(t('adminManage.saved')); },
    onError: () => toast.error(t('adminManage.saveFailed')),
  });

  const grantMutation = useMutation({
    mutationFn: ({ cohortId, user_id, permission }) => setCohortPermission(cohortId, { user_id, permission }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacher-cohort-perms'] }); setGrantCohortId(''); toast.success(t('adminManage.grantSuccess')); },
    onError: () => toast.error(t('adminManage.grantFailed')),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ cohortId, userId }) => removeCohortPermission(cohortId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacher-cohort-perms'] }); toast.success(t('adminManage.revokeSuccess')); },
    onError: () => toast.error(t('adminManage.revokeFailed')),
  });

  const cardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' };
  const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: 'var(--border-width) solid var(--color-border)' };
  const tdStyle = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)' };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
      {/* Left: Teacher list */}
      <div style={{ flex: '1 1 280px', minWidth: '260px' }}>
        {usersLoading ? <LoadingSpinner label={t('adminManage.loading')} /> : (
          <div style={{ ...cardStyle, maxHeight: '70vh', overflowY: 'auto' }}>
            {teachers.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <div key={user.id} onClick={() => setSelectedUser(user)} style={{
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--color-surface)',
                  borderBottom: 'var(--border-width) solid var(--color-border)',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedUser(user)}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                      {user.display_name || user.email.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{user.email}</div>
                  </div>
                  <span style={{
                    fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', fontWeight: 500,
                    background: user.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                    color: user.role === 'admin' ? '#1d4ed8' : '#6b7280',
                  }}>
                    {user.role === 'admin' ? t('adminManage.admin') : t('adminManage.counsellor')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Teacher detail */}
      <div style={{ flex: '2 1 400px', minWidth: '340px' }}>
        {!selectedUser ? (
          <div style={{ ...cardStyle, padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.selectTeacher')}</p>
          </div>
        ) : (
          <TeacherDetail
            user={selectedUser} cohorts={cohorts} account={account}
            onRoleChange={(role) => updateUserMutation.mutate({ userId: selectedUser.id, role })}
            roleUpdating={updateUserMutation.isPending}
            onUpdateName={(name) => updateUserMutation.mutate({ userId: selectedUser.id, display_name: name })}
            onToggleCohortMgmt={(val) => updateUserMutation.mutate({ userId: selectedUser.id, can_manage_cohorts: val })}
            grantCohortId={grantCohortId} setGrantCohortId={setGrantCohortId}
            grantPermission={grantPermission} setGrantPermission={setGrantPermission}
            onGrant={() => grantMutation.mutate({ cohortId: grantCohortId, user_id: selectedUser.id, permission: grantPermission })}
            grantPending={grantMutation.isPending}
            onRevoke={(cohortId) => revokeMutation.mutate({ cohortId, userId: selectedUser.id })}
            revokePending={revokeMutation.isPending}
            t={t} thStyle={thStyle} tdStyle={tdStyle} cardStyle={cardStyle}
          />
        )}
      </div>
    </div>
  );
}

function TeacherDetail({ user, cohorts, account, onRoleChange, roleUpdating, onToggleCohortMgmt, onUpdateName, grantCohortId, setGrantCohortId, grantPermission, setGrantPermission, onGrant, grantPending, onRevoke, revokePending, t, thStyle, tdStyle, cardStyle }) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user.display_name || '');
  const permsQuery = useQuery({
    queryKey: ['teacher-cohort-perms', user.id],
    queryFn: async () => {
      const results = [];
      for (const cohort of cohorts) {
        try {
          const data = await getCohortPermissions(cohort.id);
          const perms = data.permissions ?? [];
          const userPerm = perms.find(p => p.user_id === user.id);
          if (userPerm) results.push({ cohort_id: cohort.id, cohort_name: cohort.name, permission: userPerm.permission });
        } catch { /* skip */ }
      }
      return results;
    },
    enabled: cohorts.length > 0,
  });

  const cohortPerms = permsQuery.data ?? [];
  const assignedCohortIds = new Set(cohortPerms.map(p => p.cohort_id));
  const availableCohorts = cohorts.filter(c => !assignedCohortIds.has(c.id));
  const isSelf = account?.email === user.email;

  return (
    <div>
      {/* Header */}
      <div style={{ ...cardStyle, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            {editingName ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameValue.trim()) { onUpdateName(nameValue.trim()); setEditingName(false); }
                    if (e.key === 'Escape') { setNameValue(user.display_name || ''); setEditingName(false); }
                  }}
                  style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', padding: 'var(--space-1) var(--space-2)', border: 'var(--border-width) solid var(--color-primary)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', width: '220px' }}
                />
                <Button variant="secondary" onClick={() => { if (nameValue.trim()) { onUpdateName(nameValue.trim()); setEditingName(false); } }}>
                  {t('common.save')}
                </Button>
                <button onClick={() => { setNameValue(user.display_name || ''); setEditingName(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-base)' }}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <h2
                style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, cursor: 'pointer' }}
                onClick={() => setEditingName(true)}
                title={t('adminManage.clickToEditName')}
              >
                {user.display_name || user.email.split('@')[0]}
                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-normal)' }}>✎</span>
              </h2>
            )}
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>{user.email}</p>
          </div>
          {!isSelf && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('adminManage.role')}:</label>
              <select value={user.role} onChange={(e) => onRoleChange(e.target.value)} disabled={roleUpdating} style={{
                padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-sm)',
                border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)',
              }}>
                <option value="counsellor">{t('adminManage.counsellor')}</option>
                <option value="admin">{t('adminManage.admin')}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cohort Management toggle */}
      <div style={{ ...cardStyle, padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
            {t('adminManage.cohortMgmtPermission')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {t('adminManage.cohortMgmtDesc')}
          </div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={user.can_manage_cohorts || user.role === 'admin'}
            disabled={user.role === 'admin'}
            onChange={(e) => onToggleCohortMgmt(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
            aria-label="Toggle cohort management"
          />
          <span style={{
            position: 'absolute', cursor: user.role === 'admin' ? 'default' : 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            background: (user.can_manage_cohorts || user.role === 'admin') ? 'var(--color-primary)' : '#cbd5e1',
            borderRadius: '12px', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', height: '18px', width: '18px',
              left: (user.can_manage_cohorts || user.role === 'admin') ? '23px' : '3px',
              bottom: '3px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
            }} />
          </span>
        </label>
      </div>

      {/* Cohort Scope */}
      <div style={cardStyle}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
          {t('adminManage.cohortScope')}
        </div>
        <p style={{ padding: 'var(--space-2) var(--space-4) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('adminManage.cohortScopeDesc')}
        </p>

        {permsQuery.isLoading ? (
          <div style={{ padding: 'var(--space-4)' }}><LoadingSpinner label={t('adminManage.loading')} /></div>
        ) : cohortPerms.length === 0 ? (
          <p style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('adminManage.noPermissions')}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>{t('adminManage.cohortName')}</th>
                <th style={thStyle}>{t('adminManage.permission')}</th>
                <th style={thStyle}>{t('adminManage.actions')}</th>
              </tr></thead>
              <tbody>
                {cohortPerms.map((p) => (
                  <tr key={p.cohort_id}>
                    <td style={tdStyle}>{p.cohort_name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', fontWeight: 500,
                        background: p.permission === 'read_write' ? '#dcfce7' : '#fef3c7',
                        color: p.permission === 'read_write' ? '#166534' : '#92400e',
                      }}>
                        {p.permission === 'read_write' ? t('adminManage.readWrite') : t('adminManage.readOnly')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => onRevoke(p.cohort_id)} disabled={revokePending} style={{
                        background: 'none', border: 'var(--border-width) solid var(--color-error)',
                        borderRadius: 'var(--border-radius-sm)', color: 'var(--color-error)',
                        fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', fontFamily: 'var(--font-family-base)',
                      }}>{t('adminManage.removeAccess')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grant access form */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border-width) solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
          <select value={grantCohortId} onChange={(e) => setGrantCohortId(e.target.value)} style={{ padding: 'var(--space-2)', fontSize: 'var(--font-size-sm)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', flex: '2 1 200px' }}>
            <option value="">{t('adminManage.selectCohort')}</option>
            {availableCohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={grantPermission} onChange={(e) => setGrantPermission(e.target.value)} style={{ padding: 'var(--space-2)', fontSize: 'var(--font-size-sm)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', flex: '1 1 120px' }}>
            <option value="read_write">{t('adminManage.readWrite')}</option>
            <option value="read_only">{t('adminManage.readOnly')}</option>
          </select>
          <Button onClick={onGrant} disabled={!grantCohortId || grantPending}>
            {grantPending ? t('adminManage.saving') : t('adminManage.addAccess')}
          </Button>
        </div>
      </div>
    </div>
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
            {cohorts.length} {cohorts.length === 1 ? 'cohort' : 'cohorts'}
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
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{c.description}</div>}
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {c.member_count} students
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
                  <button onClick={() => setDeleteTarget(selectedCohort)} style={{
                    background: 'none', border: 'var(--border-width) solid var(--color-error)',
                    borderRadius: 'var(--border-radius-sm)', color: 'var(--color-error)',
                    fontSize: 'var(--font-size-sm)', padding: 'var(--space-1) var(--space-3)', cursor: 'pointer', fontFamily: 'var(--font-family-base)',
                  }}>{t('common.delete')}</button>
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
            Delete cohort <strong>{deleteTarget?.name}</strong>? Students are not affected.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('dashboard.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t('cohorts.deleting') : t('common.delete')}
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
