import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';

export default function QueryBoundary({ isLoading, isError, error, refetch, children, resourceName = 'data' }) {
  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}>
        <LoadingSpinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert">
        <ErrorMessage message={`Something went wrong loading ${resourceName}.`} />
        <button
          onClick={() => refetch()}
          style={{
            color: 'var(--color-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-family-base)',
            fontSize: 'var(--font-size-sm)',
            padding: 'var(--space-2) 0',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  return children;
}
