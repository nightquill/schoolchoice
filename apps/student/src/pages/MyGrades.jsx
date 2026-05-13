import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { Button } from '@schoolchoice/ui/primitives/button';
import { ArrowLeft } from 'lucide-react';
import { getMyGrades } from '../api/student';

export default function MyGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyGrades()
      .then((data) => {
        setGrades(Array.isArray(data) ? data : data.grades || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load grades.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">My Grades</h1>
            {user?.name && (
              <p className="text-sm text-muted-foreground">{user.name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading grades...</p>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && grades.length === 0 && (
          <div className="rounded-md border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">No grades recorded yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Your counsellor will enter your grades.</p>
          </div>
        )}

        {!loading && grades.length > 0 && (
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sitting</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Year</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Grade</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Predicted</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{g.subject}</td>
                    <td className="px-4 py-2 text-foreground">{g.sitting || '-'}</td>
                    <td className="px-4 py-2 text-foreground">{g.year || '-'}</td>
                    <td className="px-4 py-2 text-foreground font-medium">{g.grade || '-'}</td>
                    <td className="px-4 py-2 text-foreground">{g.predicted_grade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
