// REQ-031: Authentication - Login page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { login as apiLogin } from '@schoolchoice/ui/api/auth';
import { FormCard } from '@schoolchoice/ui';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { ErrorMessage } from '@schoolchoice/ui';

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
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
      newFieldErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newFieldErrors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      newFieldErrors.password = 'Password is required.';
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
        setError('No account found with this email address. Please register.');
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Incorrect password. Please try again.');
      } else if (status === 422) {
        setError('Please check your input and try again.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
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
      <FormCard title="Login">
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
            error={fieldErrors.email}
          />
          <TextInput
            label="Password"
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
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            No account?{' '}
            <a href="/register" style={{ color: 'var(--color-primary)' }}>Register</a>
          </p>
        </form>
      </FormCard>
    </div>
  );
}

export default LoginPage;
