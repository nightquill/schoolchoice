// ShapSummary — displays top SHAP feature explanations for a match score
// Enhanced to surface admission probability and subject weight multipliers
// when richer JUPAS scorer data is present.
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

  const probItemStyle = {
    ...itemStyle,
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-2)',
    paddingBottom: 'var(--space-1)',
    borderBottom: '1px solid var(--color-border)',
  };

  const directionStyle = (positive) => ({
    color: positive ? 'var(--color-success)' : 'var(--color-error)',
    fontWeight: 'var(--font-weight-medium)',
    flexShrink: 0,
  });

  const weightBadgeStyle = {
    background: 'rgba(37,99,235,0.08)',
    border: '1px solid rgba(37,99,235,0.2)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-primary)',
    marginLeft: '4px',
    fontFamily: 'monospace',
    flexShrink: 0,
  };

  /**
   * Build the display label for a feature.
   * If the feature carries subject-level data (subject_code, weight, weighted_pts),
   * render "SUBJ (×W) = X pts". Otherwise fall back to explanation or name.
   */
  function featureLabel(feature) {
    // Admission probability — special prominent label
    if (feature.name === 'admission_probability' || feature.feature_type === 'admission_probability') {
      const pct = feature.probability != null
        ? `${Math.round(feature.probability * 100)}%`
        : feature.explanation || '';
      return { isProbability: true, label: `Admission probability: ${pct}` };
    }

    // Subject detail feature with weight multiplier
    if (feature.subject_code && feature.weight != null) {
      const code = feature.subject_code.toUpperCase();
      const weightStr = `\u00d7${feature.weight}`;
      const pts = feature.weighted_pts != null
        ? ` = ${feature.weighted_pts.toFixed(2)}pts`
        : '';
      return { isProbability: false, label: `${code}`, weightBadge: weightStr, pts };
    }

    // Default: use explanation text or name
    return { isProbability: false, label: feature.explanation || feature.name || String(feature) };
  }

  // Separate admission probability feature (if any) so it renders first/prominently
  const probFeature = features.find(
    (f) => f.name === 'admission_probability' || f.feature_type === 'admission_probability'
  );
  const otherFeatures = features.filter(
    (f) => f.name !== 'admission_probability' && f.feature_type !== 'admission_probability'
  );

  return (
    <ul style={listStyle} aria-label="Match explanation">
      {probFeature && (() => {
        const { label } = featureLabel(probFeature);
        const isPositive = probFeature.value > 0 || probFeature.direction === 'positive';
        return (
          <li key="prob" style={probItemStyle}>
            <span style={directionStyle(isPositive)} aria-hidden="true">
              {isPositive ? '\u2191' : '\u2193'}
            </span>
            <span>{label}</span>
          </li>
        );
      })()}

      {otherFeatures.map((feature, index) => {
        const isPositive = feature.value > 0 || feature.direction === 'positive';
        const { label, weightBadge, pts } = featureLabel(feature);
        return (
          <li key={index} style={itemStyle}>
            <span style={directionStyle(isPositive)} aria-hidden="true">
              {isPositive ? '\u2191' : '\u2193'}
            </span>
            <span>{label}</span>
            {weightBadge && (
              <span style={weightBadgeStyle} title={`Weight multiplier: ${weightBadge}`}>
                {weightBadge}
              </span>
            )}
            {pts && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {pts}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default ShapSummary;
