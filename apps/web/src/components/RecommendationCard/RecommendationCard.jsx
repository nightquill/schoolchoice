function RecommendationCard({ recommendation }) {
  const { rank, school_name, score, explanation, gaps } = recommendation;

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-4)',
    marginBottom: 'var(--space-4)',
    boxShadow: 'var(--shadow-sm)',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 'var(--space-3)',
  };

  const schoolNameStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const scoreStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
  };

  const dividerStyle = {
    border: 'none',
    borderTop: 'var(--border-width) solid var(--color-border)',
    margin: 'var(--space-3) 0',
  };

  const sectionLabelStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-1)',
    display: 'block',
  };

  const sectionContentStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  };

  const sectionStyle = {
    marginBottom: 'var(--space-4)',
  };

  const scorePercent = typeof score === 'number' ? `${(score * 100).toFixed(0)}%` : score;
  const rankPrefix = rank != null ? `${rank}. ` : '';

  const explanationText = typeof explanation === 'object' && explanation !== null
    ? explanation.why_matches || JSON.stringify(explanation)
    : explanation;

  const gapsText = typeof gaps === 'object' && gaps !== null
    ? JSON.stringify(gaps)
    : gaps;

  return (
    <article
      style={cardStyle}
      role="article"
      aria-label={`${rankPrefix}${school_name}, score ${scorePercent}`}
    >
      <div style={headerStyle}>
        <h3 style={schoolNameStyle}>{rankPrefix}{school_name}</h3>
        <span style={scoreStyle}>Score: {scorePercent}</span>
      </div>
      <hr style={dividerStyle} />
      <div style={sectionStyle}>
        <span style={sectionLabelStyle}>Why it matches</span>
        <p style={sectionContentStyle}>{explanationText}</p>
      </div>
      <div style={sectionStyle}>
        <span style={sectionLabelStyle}>Gaps</span>
        <p style={sectionContentStyle}>{gapsText}</p>
      </div>
    </article>
  );
}

export default RecommendationCard;
