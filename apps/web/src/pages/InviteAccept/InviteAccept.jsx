import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { validateInvite, acceptInvite } from '../../api/invite';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateInvite(token)
      .then(data => { setInfo(data); setLoading(false); })
      .catch(err => {
        setError(err?.response?.data?.detail || 'Invalid or expired invite link.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await acceptInvite(token, password);
      localStorage.setItem('token', result.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-background)', fontFamily: 'var(--font-family-base)', padding: 'var(--space-4)',
  };
  const cardStyle = {
    background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-lg)', padding: 'var(--space-8)', maxWidth: '420px', width: '100%',
  };
  const labelStyle = {
    display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)',
  };

  if (loading) return <div style={containerStyle}><div style={cardStyle}><p style={{ color: 'var(--color-text-secondary)' }}>Validating invite...</p></div></div>;

  if (!info) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Invite Link Invalid</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>{error}</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Contact your school counsellor to request a new invite.</p>
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Welcome, {info.student_name}</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          {info.school_name ? `${info.school_name} — ` : ''}Set your password to access the school portal.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>Email</label>
            <Input value={info.email} disabled style={{ opacity: 0.7 }} />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>Password</label>
            <Input type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required autoFocus />
          </div>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Confirm Password</label>
            <Input type="password" name="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required />
          </div>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>{error}</p>}
          <Button type="submit" disabled={submitting || !password || !confirmPassword} style={{ width: '100%', marginTop: 'var(--space-2)' }}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
