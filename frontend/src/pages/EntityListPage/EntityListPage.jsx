import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import QueryBoundary from '../../components/QueryBoundary/QueryBoundary';
import EntityListView from '../../components/EntityListView/EntityListView';
import { getEntitySchema, getEntityList } from '../../api/entities';

const pageStyle = { background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' };
const contentStyle = { paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' };
const headingStyle = { fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', textTransform: 'capitalize' };

export default function EntityListPage() {
  const { name } = useParams();
  const navigate = useNavigate();

  const schemaQuery = useQuery({ queryKey: ['schema', name], queryFn: () => getEntitySchema(name) });
  const listQuery = useQuery({
    queryKey: ['entities', name],
    queryFn: () => getEntityList(schemaQuery.data?.table || name),
    enabled: !!schemaQuery.data,
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 />
      <main id="main-content" className="px-4 md:px-8 overflow-x-auto" style={contentStyle}>
        <h1 style={headingStyle}>{name}</h1>
        <QueryBoundary
          isLoading={schemaQuery.isLoading || listQuery.isLoading}
          isError={schemaQuery.isError || listQuery.isError}
          error={schemaQuery.error || listQuery.error}
          refetch={() => { schemaQuery.refetch(); listQuery.refetch(); }}
          resourceName={name}
        >
          <EntityListView
            schema={schemaQuery.data}
            rows={listQuery.data}
            onRowClick={(id) => navigate(`/entities/${name}/${id}`)}
          />
        </QueryBoundary>
      </main>
    </div>
  );
}
