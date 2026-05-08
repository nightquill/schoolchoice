// REQ-097: Account Settings Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { FormCard } from '@schoolchoice/ui';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { toast } from 'sonner';
import { Modal } from '@schoolchoice/ui';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { getAccount, updateAccount, changePassword, deleteAccount } from '@schoolchoice/ui/api/account';

function AccountSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Display name section
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Password section
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_new_password: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  // Preferences section
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Delete account modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAccount()
      .then((data) => {
        setAccount(data);
        setDisplayName(data.display_name || '');
        setPreferredLanguage(data.preferred_language || 'en');
      })
      .catch(() => setError('Failed to load account settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const updated = await updateAccount({ display_name: displayName });
      setAccount(updated);
      toast.success('Display name saved.');
    } catch {
      toast.error('Failed to save display name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    setPwErrors({});
    if (pwForm.new_password !== pwForm.confirm_new_password) {
      setPwErrors({ confirm_new_password: 'Passwords do not match.' });
      return;
    }
    if (!pwForm.new_password) {
      setPwErrors({ new_password: 'New password is required.' });
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwForm({ current_password: '', new_password: '', confirm_new_password: '' });
      toast.success('Password changed successfully.');
    } catch (err) {
      if (err?.response?.status === 401) {
        setPwErrors({ current_password: 'Incorrect current password.' });
      } else if (err?.response?.status === 422) {
        setPwErrors(err.response.data?.errors || { new_password: 'Password does not meet requirements.' });
      } else {
        toast.error('Failed to change password.');
      }
    } finally {
      setSavingPw(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const updated = await updateAccount({ preferred_language: preferredLanguage });
      setAccount(updated);
      toast.success('Preferences saved.');
    } catch {
      toast.error('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      logout();
      navigate('/login');
    } catch (err) {
      if (err?.response?.status === 401) {
        setDeleteError('Incorrect password. Please try again.');
      } else {
        setDeleteError('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '640px',
    margin: '0 auto',
    padding: 'var(--space-10) var(--space-8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)',
  };

  const cardStyle = (danger = false) => ({
    background: 'var(--color-surface)',
    border: `var(--border-width) solid ${danger ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
  });

  const cardTitleStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-4)',
  };

  const toggleBtnStyle = (active) => ({
    padding: 'var(--space-2) var(--space-4)',
    border: `var(--border-width) solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius-sm)',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#ffffff' : 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: active ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
  });

  const helperNoteStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    marginTop: 'var(--space-2)',
    display: 'block',
  };

  if (loading) return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <div style={{ padding: 'var(--space-10)' }}><LoadingSpinner label="Loading account settings..." /></div>
    </div>
  );

  if (error) return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <div style={{ padding: 'var(--space-10)' }}><ErrorMessage message={error} /></div>
    </div>
  );

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <main id="main-content" style={contentStyle}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
          Account Settings
        </h1>

        {/* Display Name */}
        <div style={cardStyle()}>
          <h2 style={cardTitleStyle}>Profile</h2>
          <TextInput
            label="Display Name"
            name="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button onClick={handleSaveName} disabled={savingName}>
            {savingName ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Email */}
        <div style={cardStyle()}>
          <h2 style={cardTitleStyle}>Email Address</h2>
          <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {account?.email}
          </p>
          <span style={helperNoteStyle}>To change your email address, contact your administrator.</span>
        </div>

        {/* Change Password */}
        <div style={cardStyle()}>
          <h2 style={cardTitleStyle}>Change Password</h2>
          <TextInput
            label="Current Password"
            name="current_password"
            type="password"
            value={pwForm.current_password}
            onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
            error={pwErrors.current_password}
          />
          <TextInput
            label="New Password"
            name="new_password"
            type="password"
            value={pwForm.new_password}
            onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
            error={pwErrors.new_password}
          />
          <TextInput
            label="Confirm New Password"
            name="confirm_new_password"
            type="password"
            value={pwForm.confirm_new_password}
            onChange={(e) => setPwForm((f) => ({ ...f, confirm_new_password: e.target.value }))}
            error={pwErrors.confirm_new_password}
          />
          <Button onClick={handleChangePassword} disabled={savingPw}>
            {savingPw ? 'Changing...' : 'Change Password'}
          </Button>
        </div>

        {/* Preferences */}
        <div style={cardStyle()}>
          <h2 style={cardTitleStyle}>Preferences</h2>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Preferred Language
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                style={toggleBtnStyle(preferredLanguage === 'en')}
                onClick={() => setPreferredLanguage('en')}
                aria-pressed={preferredLanguage === 'en'}
              >
                English
              </button>
              <button
                style={toggleBtnStyle(preferredLanguage === 'zh-HK')}
                onClick={() => setPreferredLanguage('zh-HK')}
                aria-pressed={preferredLanguage === 'zh-HK'}
              >
                中文
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Email Notifications{' '}
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>(coming soon)</span>
            </p>
            <input type="checkbox" disabled aria-label="Email notifications (coming soon)" />
          </div>
          <Button onClick={handleSavePrefs} disabled={savingPrefs}>
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>

        {/* Danger Zone */}
        <div style={cardStyle(true)}>
          <h2 style={{ ...cardTitleStyle, color: 'var(--color-error)' }}>Danger Zone</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Deleting your account is permanent and cannot be undone.
          </p>
          <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>Delete Account</Button>
        </div>
      </main>

      <Modal
        isOpen={deleteModalOpen}
        title="Delete Account"
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletePassword('');
          setDeleteError('');
        }}
        onConfirm={handleDeleteAccount}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, Delete My Account'}
        confirmVariant="danger"
      >
        <p style={{ marginBottom: 'var(--space-4)', lineHeight: 'var(--line-height-normal)' }}>
          This action cannot be undone. Your account will be deactivated and you will be logged out. Enter your password to confirm.
        </p>
        <TextInput
          label="Password"
          name="delete_confirm_password"
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          error={deleteError}
        />
      </Modal>

    </div>
  );
}

export default AccountSettings;
