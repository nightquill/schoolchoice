function ActionPlanDisplay({ actionPlan }) {
  const { academic_targets, extracurricular_direction, preparation_steps } = actionPlan;

  const containerStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-6)',
  };

  const sectionStyle = {
    marginBottom: 'var(--space-6)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    marginBottom: 'var(--space-2)',
  };

  const contentStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  };

  return (
    <div style={containerStyle} role="region" aria-label="Action Plan">
      <div style={sectionStyle}>
        <span style={labelStyle}>Academic Targets</span>
        <p style={contentStyle}>{academic_targets}</p>
      </div>
      <div style={sectionStyle}>
        <span style={labelStyle}>Extracurricular Direction</span>
        <p style={contentStyle}>{extracurricular_direction}</p>
      </div>
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <span style={labelStyle}>Preparation Steps</span>
        <p style={contentStyle}>{preparation_steps}</p>
      </div>
    </div>
  );
}

export default ActionPlanDisplay;
