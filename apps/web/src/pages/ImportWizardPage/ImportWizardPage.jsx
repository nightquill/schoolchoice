import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { QueryBoundary } from '@schoolchoice/ui';
import ImportWizard from '../../components/ImportWizard/ImportWizard';
import { getEntitySchema } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';

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
  const { name } = useParams();

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const schemaQuery = useQuery({
    queryKey: ['schema', name],
    queryFn: () => getEntitySchema(name),
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main id="main-content" className="px-4 md:px-8" style={contentStyle}>
        <h1 style={headingStyle}>Import {name}</h1>
        <div style={{
          marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)', fontSize: 'var(--font-size-sm)',
        }}>
          <p style={{ margin: '0 0 var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
            Accepted formats: <strong>CSV</strong> (.csv) and <strong>Excel</strong> (.xlsx)
          </p>
          {name === 'student' && (
            <>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Student columns:</strong> name, class_name, year_of_study, gender, target_region, date_of_birth, preferred_language
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Grade columns:</strong> CHLA, ENGL, MATH, CSD, PHYS, CHEM, BIOL, ECON, HIST, GEOG, ICT, M1, M2 (use HKDSE grades: 5**, 5*, 5, 4, 3, 2, 1, U, A, AD)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Sitting columns:</strong> sitting (MOCK / TRIAL / OFFICIAL), year_of_exam (e.g. 2025)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                Existing students matched by name — new names auto-create, existing names update data.
              </p>
              <a
                href="/data/sample-students.csv"
                download="sample-students.csv"
                style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', textDecoration: 'underline' }}
              >
                Download sample CSV (10 students with grades)
              </a>
            </>
          )}
          {name !== 'student' && (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Your file should contain columns matching the entity schema. Column headers will be auto-mapped.
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
