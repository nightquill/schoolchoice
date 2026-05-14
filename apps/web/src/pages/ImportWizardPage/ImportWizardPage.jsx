import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { QueryBoundary } from '@schoolchoice/ui';
import ImportWizard from '../../components/ImportWizard/ImportWizard';
import { getEntitySchema } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
};

const contentStyle = {
  paddingTop: 'var(--space-6)',
  paddingBottom: 'var(--space-6)',
};

const headingStyle = {
  fontSize: '24px',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-4)',
  textTransform: 'capitalize',
};

export default function ImportWizardPage() {
  const { t } = useTranslation();  const { name } = useParams();

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const schemaQuery = useQuery({
    queryKey: ['schema', name],
    queryFn: () => getEntitySchema(name),
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main id="main-content" className="px-4 md:px-8" style={contentStyle}>
        <h1 style={headingStyle}>{t('import.title')} {name}</h1>
        <div style={{
          marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)', fontSize: 'var(--font-size-sm)',
        }}>
          <p style={{ margin: '0 0 var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
            {t('import.acceptedFormats')} <strong>CSV</strong> (.csv) &amp; <strong>Excel</strong> (.xlsx)
          </p>
          {name === 'student' && (
            <>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.studentColumns')}</strong> {t('import.studentColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.gradeColumns')}</strong> {t('import.gradeColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.sittingColumns')}</strong> {t('import.sittingColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                {t('import.matchByName')}
              </p>
              <a
                href="/data/sample-students.csv"
                download="sample-students.csv"
                style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', textDecoration: 'underline' }}
              >
                {t('import.downloadSample')}
              </a>
            </>
          )}
          {name !== 'student' && (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              {t('import.columnAutoMap')}
            </p>
          )}
        </div>
        <QueryBoundary
          isLoading={schemaQuery.isLoading}
          isError={schemaQuery.isError}
          error={schemaQuery.error}
          refetch={schemaQuery.refetch}
          resourceName={name}
        >
          <ImportWizard entityName={name} schema={schemaQuery.data} />
        </QueryBoundary>
      </main>
    </div>
  );
}
