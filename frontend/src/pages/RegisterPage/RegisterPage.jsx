// REQ-031: Authentication - Register page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { register as apiRegister, login as apiLogin } from '../../api/auth';
import FormCard from '../../components/FormCard/FormCard';
import TextInput from '../../components/TextInput/TextInput';
import Button from '../../components/Button/Button';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';

function RegisterPage() {
  const { isAuthenticated, login } = useAuth();
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
        setError('An account with this email already exists.');
      } else if (status === 422) {
        // FastAPI returns detail as an array of validation errors
        const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join('. ') : (detail || 'Invalid input.');
        setError(msg);
      } else {
        setError(typeof detail === 'string' ? detail : 'Registration failed. Please try again.');
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
      <FormCard title="Create Account">
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <ErrorMessage message={error} />}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button
              label="Create Account"
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={loading}
            />
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--color-primary)' }}>Log in</a>
          </p>
        </form>
      </FormCard>
    </div>
  );
}

export default RegisterPage;
