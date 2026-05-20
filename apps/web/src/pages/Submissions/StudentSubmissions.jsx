// Student's own submission history page
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import SubmissionHistory from '../../components/SubmissionHistory/SubmissionHistory';

export default function StudentSubmissions() {
  const { t } = useTranslation();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data;

  if (accountQuery.isLoading) {
    return <div style={{ background: 'var(--color-background)', minHeight: '100vh' }}><LoadingSpinner label={t('common.loading')} /></div>;
  }

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-block', marginBottom: 'var(--space-4)' }}>
          {t('methodology.backToDashboard')}
        </Link>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
          {t('nav.mySubmissions')}
        </h1>
        <SubmissionHistory studentId={account?.student_id} isStudent={true} />
      </div>
    </div>
  );
}
