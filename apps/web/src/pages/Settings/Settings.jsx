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
        toast.error('You do not have permission to perform this action.');
      } else {
        toast.error('Failed to load users.');
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
        toast.success('User updated successfully.');
      } else {
        await createUser({
          email: formData.email,
          password: formData.password,
          display_name: formData.display_name || undefined,
          role: formData.role,
        });
        toast.success('User created successfully.');
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error('A user with this email already exists.');
      } else if (err?.response?.status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else {
        const action = editingUser ? 'update' : 'create';
        toast.error(`Failed to ${action} user. Please try again.`);
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
      toast.success('User deleted.');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else {
        toast.error('Failed to delete user. Please try again.');
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
          <LoadingSpinner label="Loading..." />
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
          Settings
        </h1>

        <Tabs defaultValue="users">
          <TabsList variant="line">
            <TabsTrigger value="users">Users</TabsTrigger>
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
                  User Management
                </h2>
                <Button onClick={openCreateDialog}>Create User</Button>
              </div>

              {usersLoading ? (
                <LoadingSpinner label="Loading users..." />
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
                    No users found.
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    Create a user account to get started.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col">Email</TableHead>
                      <TableHead scope="col">Role</TableHead>
                      <TableHead scope="col">Created</TableHead>
                      <TableHead scope="col" style={{ width: '48px' }}>
                        Actions
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
                              {u.role === 'admin' ? 'Admin' : 'Counsellor'}
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
                                aria-label="Actions"
                              >
                                <MoreVertical size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(u)}>
                                  Edit
                                </DropdownMenuItem>
                                {isSelf ? (
                                  <DropdownMenuItem
                                    disabled
                                    title="You cannot delete your own account."
                                    aria-disabled="true"
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => openDeleteDialog(u)}
                                    className="text-destructive"
                                  >
                                    Delete
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
            <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
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
                Full Name
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
                Email
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
                Password
              </label>
              <Input
                id="user-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                required={!editingUser}
                placeholder={editingUser ? 'Leave blank to keep current password' : ''}
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
                Role
              </label>
              <Select value={formData.role} onValueChange={(val) => setFormData((f) => ({ ...f, role: val }))}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="counsellor">Counsellor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p
            style={{
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-primary)',
              lineHeight: 'var(--line-height-normal)',
              margin: 0,
            }}
          >
            Are you sure you want to delete {deletingUser?.display_name || deletingUser?.email}?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost" />}
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingUser(null);
              }}
            >
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default Settings;
