import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSubmissions } from '../../api/submissions';
import { useTranslation } from '@schoolchoice/ui/i18n';

function SubmissionList() {
  const { t } = useTranslation();  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const submissionsQuery = useQuery({ queryKey: ['submissions'], queryFn: getSubmissions });

  const account = accountQuery.data ?? null;
  const submissions = submissionsQuery.data?.submissions ?? [];
  const loading = submissionsQuery.isLoading;
  const error = submissionsQuery.error;

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    background: 'var(--color-background)',
  };

  const tdStyle = {
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <h1 style={{ ...headingStyle, marginBottom: 'var(--space-4)' }}>
          Pending Submissions {!loading && !error ? `(${submissions.length})` : ''}
        </h1>

        {loading && <LoadingSpinner label="Loading submissions..." />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && submissions.length === 0 && (
          <EmptyState message="No pending submissions." />
        )}
        {!loading && !error && submissions.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Student Name</th>
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>Choices</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={tdStyle}>{sub.student_name || 'Unknown'}</td>
                    <td style={tdStyle}>{sub.class_name || '-'}</td>
                    <td style={tdStyle}>{sub.choice_count ?? sub.choices?.length ?? '-'}</td>
                    <td style={tdStyle}>
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/submissions/${sub.id}`}
                        style={{
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          fontWeight: 'var(--font-weight-medium)',
                        }}
                      >
                        Review
                      </Link>
                    </td>
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

export default SubmissionList;
