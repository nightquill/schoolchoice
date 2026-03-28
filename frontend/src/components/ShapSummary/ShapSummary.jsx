// ShapSummary — displays top SHAP feature explanations for a match score
function ShapSummary({ shapExplanation, maxFeatures = 3 }) {
  if (!shapExplanation) return null;

  const features = Array.isArray(shapExplanation.features)
    ? shapExplanation.features.slice(0, maxFeatures)
    : [];

  if (features.length === 0) return null;

  const listStyle = {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    marginBottom: 'var(--space-1)',
  };

  const directionStyle = (positive) => ({
    color: positive ? 'var(--color-success)' : 'var(--color-error)',
    fontWeight: 'var(--font-weight-medium)',
    flexShrink: 0,
  });

  return (
    <ul style={listStyle} aria-label="Match explanation">
      {features.map((feature, index) => {
        const isPositive = feature.value > 0 || feature.direction === 'positive';
        return (
          <li key={index} style={itemStyle}>
            <span style={directionStyle(isPositive)} aria-hidden="true">
              {isPositive ? '\u2191' : '\u2193'}
            </span>
            <span>{feature.explanation || feature.name || String(feature)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default ShapSummary;
