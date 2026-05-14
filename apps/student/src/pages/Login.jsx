import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { studentLogin } from '../api/student';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [candidateNumber, setCandidateNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!candidateNumber.trim() || !password) {
      setError('Please enter your candidate number and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await studentLogin(candidateNumber.trim(), password);
      login(data.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) {
        setError('No account found with this candidate number. Contact your counsellor.');
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Incorrect password.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground text-center mb-1">Student Portal</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Sign in to manage your programme choices</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="candidate-number" className="block text-sm font-medium text-foreground mb-1">Candidate Number</label>
              <Input
                id="candidate-number"
                type="text"
                value={candidateNumber}
                onChange={(e) => { setCandidateNumber(e.target.value); if (error) setError(''); }}
                placeholder="e.g. HKDSE-2026-A001"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
