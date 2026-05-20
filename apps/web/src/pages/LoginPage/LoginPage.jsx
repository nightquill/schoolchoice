// REQ-031: Authentication - Unified Login page (teacher/admin + student) + Registration
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { login as apiLogin, studentLogin as apiStudentLogin, register as apiRegister } from '@schoolchoice/ui/api/auth';
import { FormCard } from '@schoolchoice/ui';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { ErrorMessage } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';

function LoginPage() {
  const { isAuthenticated, login, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pageMode, setPageMode] = useState('login'); // 'login' | 'register'
  const [mode, setMode] = useState('teacher'); // 'teacher' | 'student'
  const [email, setEmail] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // If user navigates to /login while authenticated, log them out
  // and clear all cached data so they can switch accounts
  useEffect(() => {
    if (isAuthenticated) {
      logout();
      queryClient.clear();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearErrors = () => {
    if (error) setError('');
    setFieldErrors({});
  };

  const handleLoginSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    clearErrors();

    const newFieldErrors = {};

    if (mode === 'teacher') {
      if (!email.trim()) {
        newFieldErrors.email = t('auth.emailRequired');
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newFieldErrors.email = t('auth.invalidEmail');
      }
    } else {
      if (!candidateNumber.trim()) {
        newFieldErrors.candidateNumber = t('auth.candidateRequired');
      }
    }
    if (!password) {
      newFieldErrors.password = t('auth.passwordRequired');
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);
    try {
      let data;
      if (mode === 'teacher') {
        data = await apiLogin(email, password);
      } else {
        data = await apiStudentLogin(candidateNumber, password);
      }
      queryClient.clear();
      await login(data.access_token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) {
        setError(mode === 'teacher' ? t('auth.noAccountFound') : t('auth.noStudentFound'));
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : t('auth.incorrectPassword'));
      } else if (status === 422) {
        setError(t('auth.checkInput'));
      } else {
        setError(typeof detail === 'string' ? detail : t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    clearErrors();

    const newFieldErrors = {};
    if (!registrationToken.trim()) {
      newFieldErrors.registrationToken = t('auth.tokenRequired');
    }
    if (!email.trim()) {
      newFieldErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newFieldErrors.email = t('auth.invalidEmail');
    }
    if (!password) {
      newFieldErrors.password = t('auth.passwordRequired');
    } else if (password.length < 8) {
      newFieldErrors.password = t('auth.passwordTooShort');
    } else if (!/[A-Z]/.test(password)) {
      newFieldErrors.password = t('auth.passwordNeedsUpper');
    } else if (!/[0-9]/.test(password)) {
      newFieldErrors.password = t('auth.passwordNeedsDigit');
    }
    if (password && password !== confirmPassword) {
      newFieldErrors.confirmPassword = t('auth.passwordMismatch');
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRegister(email, password, registrationToken);
      queryClient.clear();
      await login(data.access_token);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (status === 409) {
        setError(t('auth.emailExists'));
      } else if (status === 422) {
        setError(t('auth.checkInput'));
      } else {
        setError(typeof detail === 'string' ? detail : t('auth.registrationFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setPassword('');
  };

  const switchPageMode = (newPageMode) => {
    setPageMode(newPageMode);
    setError('');
    setFieldErrors({});
    setPassword('');
    setConfirmPassword('');
    setRegistrationToken('');
  };

  const pageStyle = {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const toggleStyle = (active) => ({
    flex: 1,
    padding: 'var(--space-2) var(--space-3)',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    border: `var(--border-width) solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: active ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
    borderRadius: 0,
    transition: 'all 0.15s',
  });

  const linkStyle = {
    display: 'block',
    textAlign: 'center',
    marginTop: 'var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-family-base)',
    textDecoration: 'underline',
  };

  return (
    <div style={pageStyle}>
      <FormCard title={pageMode === 'login' ? t('auth.login') : t('auth.registerTitle')}>

        {pageMode === 'login' && (
          <>
            {/* Mode toggle */}
            <div style={{ display: 'flex', marginBottom: 'var(--space-4)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
              <button type="button" aria-pressed={mode === 'teacher'} onClick={() => switchMode('teacher')} style={{ ...toggleStyle(mode === 'teacher'), borderRadius: 'var(--border-radius-sm) 0 0 var(--border-radius-sm)' }}>
                {t('auth.teacherAdmin')}
              </button>
              <button type="button" aria-pressed={mode === 'student'} onClick={() => switchMode('student')} style={{ ...toggleStyle(mode === 'student'), borderRadius: '0 var(--border-radius-sm) var(--border-radius-sm) 0' }}>
                {t('auth.student')}
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} noValidate>
              {mode === 'teacher' ? (
                <TextInput
                  label={t('auth.email')}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
                  required
                  error={fieldErrors.email}
                />
              ) : (
                <TextInput
                  label={t('auth.candidateNumber')}
                  name="candidateNumber"
                  type="text"
                  value={candidateNumber}
                  onChange={(e) => { setCandidateNumber(e.target.value); clearErrors(); }}
                  required
                  placeholder="e.g. HKDSE-2026-A001"
                  error={fieldErrors.candidateNumber}
                />
              )}
              <TextInput
                label={t('auth.password')}
                name="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                required
                error={fieldErrors.password}
              />
              <div role="alert">{error && <ErrorMessage message={error} />}</div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button type="submit" className="w-full text-base py-5" disabled={loading}>
                  {loading ? t('auth.loggingIn') : t('auth.logIn')}
                </Button>
              </div>
            </form>

            <button type="button" onClick={() => switchPageMode('register')} style={linkStyle}>
              {t('auth.registerHere')}
            </button>
          </>
        )}

        {pageMode === 'register' && (
          <>
            <form onSubmit={handleRegisterSubmit} noValidate>
              <TextInput
                label={t('auth.registrationToken')}
                name="registrationToken"
                type="text"
                value={registrationToken}
                onChange={(e) => { setRegistrationToken(e.target.value); clearErrors(); }}
                required
                error={fieldErrors.registrationToken}
              />
              <TextInput
                label={t('auth.email')}
                name="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
                required
                error={fieldErrors.email}
              />
              <TextInput
                label={t('auth.password')}
                name="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                required
                error={fieldErrors.password}
              />
              <TextInput
                label={t('auth.confirmPassword')}
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
                required
                error={fieldErrors.confirmPassword}
              />
              <div role="alert">{error && <ErrorMessage message={error} />}</div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button type="submit" className="w-full text-base py-5" disabled={loading}>
                  {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                </Button>
              </div>
            </form>

            <button type="button" onClick={() => switchPageMode('login')} style={linkStyle}>
              {t('auth.loginHere')}
            </button>
          </>
        )}

      </FormCard>
    </div>
  );
}

export default LoginPage;
