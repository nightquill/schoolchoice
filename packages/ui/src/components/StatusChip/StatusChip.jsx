// StatusChip — coloured pill showing application status for a target school
const STATUS_STYLES = {
  CONSIDERING: {
    background: 'var(--color-text-secondary)',
    color: '#ffffff',
  },
  APPLIED: {
    background: 'var(--color-primary)',
    color: '#ffffff',
  },
  ADMITTED: {
    background: 'var(--color-success)',
    color: '#ffffff',
  },
  REJECTED: {
    background: 'var(--color-error)',
    color: '#ffffff',
  },
  WITHDRAWN: {
    background: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
};

function StatusChip({ status }) {
  const variantStyle = STATUS_STYLES[status] || STATUS_STYLES.CONSIDERING;

  const chipStyle = {
    display: 'inline-block',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: '999px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    fontFamily: 'var(--font-family-base)',
    ...variantStyle,
  };

  return (
    <span style={chipStyle} aria-label={`Application status: ${status}`}>
      {status}
    </span>
  );
}

export default StatusChip;
