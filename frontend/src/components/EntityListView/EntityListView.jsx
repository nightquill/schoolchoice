import EmptyState from '../EmptyState/EmptyState';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)',
  overflow: 'hidden',
};

const thStyle = {
  background: 'var(--color-background)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  borderBottom: 'var(--border-width) solid var(--color-border)',
};

const tdStyle = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  fontSize: 'var(--font-size-md)',
  color: 'var(--color-text-primary)',
};

const rowHoverStyle = {
  cursor: 'pointer',
};

export default function EntityListView({ schema, rows, onRowClick }) {
  const displayFields = schema?.fields?.slice(0, 5) ?? [];

  if (!rows || rows.length === 0) {
    return <EmptyState message={`No ${schema?.name || 'records'} yet. Add the first one to get started.`} />;
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {displayFields.map((f) => (
            <th key={f.name} style={thStyle}>{f.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row.id)}
            style={rowHoverStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
          >
            {displayFields.map((f) => (
              <td key={f.name} style={tdStyle}>{String(row[f.name] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
