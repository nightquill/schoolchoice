import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getStudentPlan } from '../../api/plan';
import { useTranslation } from '@schoolchoice/ui/i18n';

export default function StudentPlan() {
  const { t } = useTranslation();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const planQuery = useQuery({ queryKey: ['student-plan'], queryFn: getStudentPlan });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
          {t('studentPlan.title')}
        </h1>

        {planQuery.isLoading && <LoadingSpinner />}

        {planQuery.isError && (
          <EmptyState message={t('studentPlan.notReleased')} />
        )}

        {planQuery.data && (
          <>
            {planQuery.data.release_note && (
              <div style={{
                background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)',
                borderRadius: 'var(--border-radius-md)', padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-info-text)',
              }}>
                <strong>{t('studentPlan.counselorNote')}:</strong> {planQuery.data.release_note}
              </div>
            )}
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              {t('studentPlan.releasedOn')}: {new Date(planQuery.data.released_at).toLocaleDateString()} · v{planQuery.data.version}
            </div>
            <iframe
              style={{ width: '100%', minHeight: '80vh', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}
              srcDoc={planQuery.data.html_content}
              title="Academic Plan"
              sandbox="allow-same-origin"
            />
          </>
        )}
      </main>
    </div>
  );
}
