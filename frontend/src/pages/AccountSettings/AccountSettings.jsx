// REQ-097: Account Settings Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import FormCard from '../../components/FormCard/FormCard';
import TextInput from '../../components/TextInput/TextInput';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Toast from '../../components/Toast/Toast';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { getAccount, updateAccount, changePassword, deleteAccount } from '../../api/account';

function AccountSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toasts, showToast, removeToast } = useToast();
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
      showToast('Display name saved.', 'success');
    } catch {
      showToast('Failed to save display name.', 'error');
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
      showToast('Password changed successfully.', 'success');
    } catch (err) {
      if (err?.response?.status === 401) {
        setPwErrors({ current_password: 'Incorrect current password.' });
      } else if (err?.response?.status === 422) {
        setPwErrors(err.response.data?.errors || { new_password: 'Password does not meet requirements.' });
      } else {
        showToast('Failed to change password.', 'error');
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
      showToast('Preferences saved.', 'success');
    } catch {
      showToast('Failed to save preferences.', 'error');
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
          <Button label="Save" onClick={handleSaveName} loading={savingName} />
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
          <Button label="Change Password" onClick={handleChangePassword} loading={savingPw} />
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
          <Button label="Save Preferences" onClick={handleSavePrefs} loading={savingPrefs} />
        </div>

        {/* Danger Zone */}
        <div style={cardStyle(true)}>
          <h2 style={{ ...cardTitleStyle, color: 'var(--color-error)' }}>Danger Zone</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Deleting your account is permanent and cannot be undone.
          </p>
          <Button label="Delete Account" variant="danger" onClick={() => setDeleteModalOpen(true)} />
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

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default AccountSettings;
