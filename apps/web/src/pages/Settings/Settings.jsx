import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { toast } from 'sonner';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { getAccount } from '@schoolchoice/ui/api/account';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/admin';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from '@schoolchoice/ui/i18n';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@schoolchoice/ui/primitives/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@schoolchoice/ui/primitives/dialog';
import { Input } from '@schoolchoice/ui/primitives/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@schoolchoice/ui/primitives/select';
import { Badge } from '@schoolchoice/ui/primitives/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@schoolchoice/ui/primitives/dropdown-menu';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@schoolchoice/ui/primitives/tabs';

function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ display_name: '', email: '', password: '', role: 'counsellor' });
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAccount()
      .then((data) => {
        setAccount(data);
        if (data.role !== 'admin') {
          navigate('/dashboard');
        }
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error(t('settings.noPermission'));
      } else {
        toast.error(t('settings.loadUsersFailed'));
      }
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account?.role === 'admin') {
      fetchUsers();
    }
  }, [account, fetchUsers]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({ display_name: '', email: '', password: '', role: 'counsellor' });
    setDialogOpen(true);
  };

  const openEditDialog = (u) => {
    setEditingUser(u);
    setFormData({
      display_name: u.display_name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'counsellor',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        const payload = {};
        if (formData.display_name !== (editingUser.display_name || '')) {
          payload.display_name = formData.display_name;
        }
        if (formData.role !== editingUser.role) {
          payload.role = formData.role;
        }
        if (formData.password) {
          payload.password = formData.password;
        }
        await updateUser(editingUser.id, payload);
        toast.success(t('settings.userUpdated'));
      } else {
        await createUser({
          email: formData.email,
          password: formData.password,
          display_name: formData.display_name || undefined,
          role: formData.role,
        });
        toast.success(t('settings.userCreated'));
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(t('settings.emailExists'));
      } else if (err?.response?.status === 403) {
        toast.error(t('settings.noPermission'));
      } else {
        toast.error(editingUser ? t('settings.updateFailed') : t('settings.createFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (u) => {
    setDeletingUser(u);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      toast.success(t('settings.userDeleted'));
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error(t('settings.noPermission'));
      } else {
        toast.error(t('settings.deleteFailed'));
      }
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const currentUserId = authUser?.id || account?.id;

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '100%',
    margin: '0 auto',
    padding: 'var(--space-10) var(--space-8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <NavBarV2 account={account} />
        <div style={{ padding: 'var(--space-10)' }}>
          <LoadingSpinner label={t('common.loading')} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <NavBarV2 account={account} />
        <div style={{ padding: 'var(--space-10)' }}>
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <main id="main-content" style={contentStyle}>
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {t('nav.settings')}
        </h1>

        <Tabs defaultValue="users">
          <TabsList variant="line">
            <TabsTrigger value="users">{t('settings.users')}</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <h2
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                  }}
                >
                  {t('settings.userManagement')}
                </h2>
                <Button onClick={openCreateDialog}>{t('settings.createUser')}</Button>
              </div>

              {usersLoading ? (
                <LoadingSpinner label={t('settings.loadingUsers')} />
              ) : users.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--space-8)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <p
                    style={{
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 700,
                      margin: '0 0 var(--space-2) 0',
                    }}
                  >
                    {t('settings.noUsersFound')}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    {t('settings.createToGetStarted')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t('common.name')}</TableHead>
                      <TableHead scope="col">{t('settings.email')}</TableHead>
                      <TableHead scope="col">{t('settings.role')}</TableHead>
                      <TableHead scope="col">{t('settings.created')}</TableHead>
                      <TableHead scope="col" style={{ width: '48px' }}>
                        {t('common.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isSelf = String(u.id) === String(currentUserId);
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <span
                              style={{
                                fontSize: 'var(--font-size-md)',
                                fontWeight: 700,
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              {u.display_name || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              style={{
                                fontSize: 'var(--font-size-md)',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              {u.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              style={
                                u.role === 'admin'
                                  ? { background: '#dbeafe', color: '#1e40af', borderColor: 'transparent' }
                                  : { background: '#f1f5f9', color: '#475569', borderColor: 'transparent' }
                              }
                            >
                              {u.role === 'admin' ? t('settings.admin') : t('settings.counsellor')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              {formatDate(u.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent cursor-pointer border-0 bg-transparent"
                                aria-label={t('common.actions')}
                              >
                                <MoreVertical size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(u)}>
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                {isSelf ? (
                                  <DropdownMenuItem
                                    disabled
                                    title={t('settings.cannotDeleteSelf')}
                                    aria-disabled="true"
                                  >
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => openDeleteDialog(u)}
                                    className="text-destructive"
                                  >
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create / Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('settings.editUser') : t('settings.createUser')}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label
                htmlFor="user-name"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('settings.fullName')}
              </label>
              <Input
                id="user-name"
                value={formData.display_name}
                onChange={(e) => setFormData((f) => ({ ...f, display_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label
                htmlFor="user-email"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('settings.email')}
              </label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                required
                disabled={!!editingUser}
              />
            </div>
            <div>
              <label
                htmlFor="user-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('settings.password')}
              </label>
              <Input
                id="user-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                required={!editingUser}
                placeholder={editingUser ? t('settings.leaveBlankPassword') : ''}
              />
            </div>
            <div>
              <label
                htmlFor="user-role"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('settings.role')}
              </label>
              <Select value={formData.role} onValueChange={(val) => setFormData((f) => ({ ...f, role: val }))}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('settings.admin')}</SelectItem>
                  <SelectItem value="counsellor">{t('settings.counsellor')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>{t('common.cancel')}</DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('settings.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('settings.deleteUser')}</DialogTitle>
          </DialogHeader>
          <p
            style={{
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-primary)',
              lineHeight: 'var(--line-height-normal)',
              margin: 0,
            }}
          >
            {t('settings.deleteConfirm')} {deletingUser?.display_name || deletingUser?.email}?
          </p>
          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost" />}
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingUser(null);
              }}
            >
              {t('common.cancel')}
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('settings.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default Settings;
