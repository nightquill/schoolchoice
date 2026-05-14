// REQ-031: Authentication - Register page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { register as apiRegister, login as apiLogin } from '@schoolchoice/ui/api/auth';
import { FormCard } from '@schoolchoice/ui';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { ErrorMessage } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';

function RegisterPage() {
  const { t } = useTranslation();  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiRegister(email, password);
      const data = await apiLogin(email, password);
      login(data.access_token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409) {
        setError(t('auth.emailExists'));
      } else if (status === 422) {
        // FastAPI returns detail as an array of validation errors
        const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join('. ') : (detail || t('auth.invalidInput'));
        setError(msg);
      } else {
        setError(typeof detail === 'string' ? detail : t('auth.registrationFailed'));
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
      <FormCard title={t('auth.createAccount')}>
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <ErrorMessage message={error} />}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button className="w-full text-base py-5" onClick={handleSubmit} disabled={loading}>
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </Button>
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            {t('auth.alreadyHaveAccount')}{' '}
            <a href="/login" style={{ color: 'var(--color-primary)' }}>{t('auth.login')}</a>
          </p>
        </form>
      </FormCard>
    </div>
  );
}

export default RegisterPage;
