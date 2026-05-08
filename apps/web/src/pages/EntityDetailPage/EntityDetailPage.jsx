import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { QueryBoundary } from '@schoolchoice/ui';
import EntityForm from '../../components/EntityForm/EntityForm';
import { toast } from 'sonner';
import { getEntitySchema, getEntityDetail, updateEntity } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';

const pageStyle = { background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' };
const contentStyle = { paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '640px' };
const headingStyle = { fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', textTransform: 'capitalize' };

export default function EntityDetailPage() {
  const { name, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const schemaQuery = useQuery({ queryKey: ['schema', name], queryFn: () => getEntitySchema(name) });
  const detailQuery = useQuery({
    queryKey: ['entity', name, id],
    queryFn: () => getEntityDetail(schemaQuery.data?.table || name, id),
    enabled: !!schemaQuery.data,
  });

  const mutation = useMutation({
    mutationFn: (payload) => updateEntity(schemaQuery.data?.table || name, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', name] });
      queryClient.invalidateQueries({ queryKey: ['entity', name, id] });
      navigate(`/entities/${name}`);
    },
    onError: () => {
      toast.error(`Failed to update ${name}.`);
    },
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main id="main-content" className="px-4 md:px-8" style={contentStyle}>
        <h1 style={headingStyle}>Edit {name}</h1>
        <QueryBoundary
          isLoading={schemaQuery.isLoading || detailQuery.isLoading}
          isError={schemaQuery.isError || detailQuery.isError}
          error={schemaQuery.error || detailQuery.error}
          refetch={() => { schemaQuery.refetch(); detailQuery.refetch(); }}
          resourceName={name}
        >
          <EntityForm
            key={detailQuery.data?.id || 'new'}
            schema={schemaQuery.data}
            initialValues={detailQuery.data || {}}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => navigate(`/entities/${name}`)}
            saving={mutation.isPending}
          />
        </QueryBoundary>
      </main>
    </div>
  );
}
