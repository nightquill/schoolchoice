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
