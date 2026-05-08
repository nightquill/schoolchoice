// EligibilityBadge — shows ELIGIBLE / INELIGIBLE / PENDING status for a school target
function EligibilityBadge({ pass, failingCriteria }) {
  const bg = (pass === null || pass === undefined)
    ? 'var(--color-text-secondary)'
    : pass
    ? 'var(--color-success)'
    : 'var(--color-error)';

  const badgeStyle = {
    display: 'inline-block',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    background: bg,
    color: '#ffffff',
    letterSpacing: '0.04em',
    position: 'relative',
  };

  const label = (pass === null || pass === undefined) ? 'PENDING' : pass ? 'ELIGIBLE' : 'INELIGIBLE';
  const ariaLabel = pass === true
    ? 'Eligible'
    : pass === false
    ? `Ineligible${failingCriteria?.length ? ': ' + failingCriteria.join('; ') : ''}`
    : 'Eligibility not yet evaluated';

  const tooltipText = pass === false && failingCriteria?.length
    ? failingCriteria.join('\n')
    : undefined;

  return (
    <span style={badgeStyle} aria-label={ariaLabel} title={tooltipText}>
      {label}
      {pass === false && failingCriteria?.length > 0 && (
        <span
          style={{
            display: 'block',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-normal)',
            opacity: 0.9,
            marginTop: '2px',
          }}
        >
          {failingCriteria[0]}
          {failingCriteria.length > 1 && ` (+${failingCriteria.length - 1} more)`}
        </span>
      )}
    </span>
  );
}

export default EligibilityBadge;
