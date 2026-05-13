// REQ-031: Authentication - Login page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { login as apiLogin } from '@schoolchoice/ui/api/auth';
import { FormCard } from '@schoolchoice/ui';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { ErrorMessage } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();

    const newFieldErrors = {};
    if (!email.trim()) {
      newFieldErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newFieldErrors.email = t('auth.invalidEmail');
    }
    if (!password) {
      newFieldErrors.password = t('auth.passwordRequired');
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiLogin(email, password);
      login(data.access_token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) {
        setError(t('auth.noAccountFound'));
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

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  return (
    <div style={pageStyle}>
      <FormCard title={t('auth.login')}>
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
            error={fieldErrors.email}
          />
          <TextInput
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            required
            error={fieldErrors.password}
          />
          {error && <ErrorMessage message={error} />}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button className="w-full text-base py-5" onClick={handleSubmit} disabled={loading}>
              {loading ? t('auth.loggingIn') : t('auth.logIn')}
            </Button>
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            {t('auth.noAccount')}{' '}
            <a href="/register" style={{ color: 'var(--color-primary)' }}>{t('auth.register')}</a>
          </p>
        </form>
      </FormCard>
    </div>
  );
}

export default LoginPage;
