import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { LoadingSpinner, Modal } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import {
  getTeacherGroups,
  createTeacherGroup,
  deleteTeacherGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
} from '../../api/teacherGroups';
import { listUsers } from '../../api/admin';
import GroupPermissions from './GroupPermissions';

function AdminTeacherGroups({ embedded = false }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount, staleTime: 5 * 60 * 1000 });
  const groupsQuery = useQuery({ queryKey: ['teacher-groups'], queryFn: getTeacherGroups });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });

  const groups = groupsQuery.data?.groups ?? [];
  const allUsers = usersQuery.data?.items ?? [];
  const teachers = allUsers.filter(u => u.role === 'counsellor' || u.role === 'admin');
  const account = accountQuery.data ?? null;

  // Auto-select first group
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  // Fetch members for selected group
  const membersQuery = useQuery({
    queryKey: ['group-members', selectedGroupId],
    queryFn: () => getGroupMembers(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const members = membersQuery.data?.members ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => createTeacherGroup(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-groups'] });
      setNewGroupName('');
      toast.success(t('teacherGroups.groupCreated'));
      if (result?.id) setSelectedGroupId(result.id);
    },
    onError: () => toast.error(t('teacherGroups.failedCreate')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTeacherGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-groups'] });
      if (selectedGroupId === deleteMutation.variables) setSelectedGroupId(null);
      toast.success(t('teacherGroups.groupDeleted'));
    },
    onError: () => toast.error(t('teacherGroups.failedDelete')),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userIds }) => addGroupMembers(groupId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-groups'] });
      setAddMemberSearch('');
      toast.success(t('teacherGroups.memberAdded'));
    },
    onError: () => toast.error(t('teacherGroups.failedAddMember')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }) => removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-groups'] });
      toast.success(t('teacherGroups.memberRemoved'));
    },
    onError: () => toast.error(t('teacherGroups.failedRemoveMember')),
  });

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    createMutation.mutate({ name });
  };

  const handleAddMember = (user) => {
    if (!user) return;
    if (members.some(m => m.user_id === user.id || m.id === user.id)) {
      toast.error(t('teacherGroups.alreadyMember'));
      return;
    }
    addMemberMutation.mutate({ groupId: selectedGroupId, userIds: [user.id] });
    setAddMemberSearch('');
  };

  // Filter teachers for the search dropdown — exclude existing members
  const memberIds = new Set(members.map(m => m.user_id || m.id));
  const availableTeachers = teachers.filter(u => !memberIds.has(u.id));
  const searchActive = addMemberSearch.trim().length > 0;
  const filteredTeachers = searchActive
    ? availableTeachers.filter(u => {
        const q = addMemberSearch.toLowerCase();
        return (u.display_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : [];

  const cardStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-md)',
    border: 'var(--border-width) solid var(--color-border)',
    overflow: 'hidden',
  };

  const thStyle = {
    padding: 'var(--space-2) var(--space-3)',
    textAlign: 'left',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const tdStyle = {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const innerContent = (
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {/* Left panel: group list */}
          <div style={{ flex: '1 1 280px', minWidth: '260px' }}>
            {/* Create group */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                placeholder={t('teacherGroups.newGroupPlaceholder')}
                style={{ flex: 1 }}
              />
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || createMutation.isPending}>
                {createMutation.isPending ? t('teacherGroups.creating') : t('teacherGroups.create')}
              </Button>
            </div>

            {groupsQuery.isLoading ? (
              <LoadingSpinner label={t('teacherGroups.loadingGroups')} />
            ) : (
              <div style={{ ...cardStyle, maxHeight: '70vh', overflowY: 'auto' }}>
                {groups.length === 0 && (
                  <p style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {t('teacherGroups.noGroups')}
                  </p>
                )}
                {groups.map((g) => {
                  const isSelected = selectedGroupId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedGroupId(g.id); } }}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--color-surface)',
                        borderBottom: 'var(--border-width) solid var(--color-border)',
                        borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                          {g.name}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {g.member_count ?? 0} member{(g.member_count ?? 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(g.id); }}
                        disabled={deleteMutation.isPending}
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
                        aria-label={`Delete group ${g.name}`}
                      >
                        {t('teacherGroups.delete')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: group detail */}
          <div style={{ flex: '2 1 500px', minWidth: '400px' }}>
            {!selectedGroup ? (
              <div style={{ ...cardStyle, padding: 'var(--space-8)', textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('teacherGroups.selectGroup')}
                </p>
              </div>
            ) : (
              <div>
                {/* Group header */}
                <div style={{ ...cardStyle, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                    {selectedGroup.name}
                  </h2>
                </div>

                {/* Members */}
                <div style={{ ...cardStyle, marginBottom: 'var(--space-4)' }}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {t('teacherGroups.members')} ({members.length})
                  </div>

                  {membersQuery.isLoading ? (
                    <div style={{ padding: 'var(--space-4)' }}><LoadingSpinner label={t('teacherGroups.loadingMembers')} /></div>
                  ) : members.length === 0 ? (
                    <p style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {t('teacherGroups.noMembers')}
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th scope="col" style={thStyle}>{t('teacherGroups.name')}</th>
                            <th scope="col" style={thStyle}>{t('teacherGroups.email')}</th>
                            <th scope="col" style={thStyle}>{t('teacherGroups.role')}</th>
                            <th scope="col" style={thStyle}>{t('teacherGroups.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m) => (
                            <tr key={m.user_id || m.id}>
                              <td style={tdStyle}>{m.display_name || m.email?.split('@')[0] || '—'}</td>
                              <td style={tdStyle}>{m.email || '—'}</td>
                              <td style={tdStyle}>
                                <span style={{
                                  fontSize: 'var(--font-size-xs)',
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  fontWeight: 500,
                                  background: m.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                                  color: m.role === 'admin' ? '#1d4ed8' : '#6b7280',
                                }}>
                                  {m.role || 'teacher'}
                                </span>
                              </td>
                              <td style={tdStyle}>
                                <button
                                  onClick={() => setConfirmRemove(m)}
                                  disabled={removeMemberMutation.isPending}
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
                                >
                                  {t('teacherGroups.remove')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add member — type to search, results appear below */}
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border-width) solid var(--color-border)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                      {t('teacherGroups.addTeacher')}
                    </div>
                    <Input
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      placeholder={t('teacherGroups.searchTeacherPlaceholder')}
                      style={{ width: '100%' }}
                    />
                    {searchActive && (
                      <div style={{
                        maxHeight: '200px', overflowY: 'auto', marginTop: 'var(--space-2)',
                        border: 'var(--border-width) solid var(--color-border)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}>
                        {filteredTeachers.length > 0 ? filteredTeachers.map(u => (
                          <div
                            key={u.id}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                                {u.display_name || u.email.split('@')[0]}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                {u.email}
                              </div>
                            </div>
                            <Button onClick={() => handleAddMember(u)} disabled={addMemberMutation.isPending}>
                              {t('teacherGroups.add')}
                            </Button>
                          </div>
                        )) : (
                          <div style={{ padding: 'var(--space-3)', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {t('teacherGroups.noTeachersMatch')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div style={cardStyle}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {t('teacherGroups.permissions')}
                  </div>
                  <GroupPermissions groupId={selectedGroupId} />
                </div>
              </div>
            )}
          </div>
        </div>
  );

  const confirmRemoveModal = (
    <Modal
      isOpen={!!confirmRemove}
      title={t('teacherGroups.remove')}
      onClose={() => setConfirmRemove(null)}
      onConfirm={() => {
        if (confirmRemove) {
          removeMemberMutation.mutate({ groupId: selectedGroupId, userId: confirmRemove.user_id || confirmRemove.id });
        }
        setConfirmRemove(null);
      }}
      confirmLabel={t('confirmation.confirm')}
      confirmVariant="danger"
      cancelLabel={t('confirmation.cancel')}
    >
      <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
        {t('confirmation.removeFromGroup', { name: confirmRemove?.display_name || confirmRemove?.email?.split('@')[0] || '' })}
      </p>
    </Modal>
  );

  if (embedded) return <>{innerContent}{confirmRemoveModal}</>;

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-6) 0' }}>
          {t('teacherGroups.title')}
        </h1>
        {innerContent}
      </div>
      {confirmRemoveModal}
    </div>
  );
}

export default AdminTeacherGroups;
