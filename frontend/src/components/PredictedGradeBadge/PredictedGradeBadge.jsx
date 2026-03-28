// PredictedGradeBadge — displays official or predicted grade with visual treatment
function PredictedGradeBadge({ grade, isOfficial }) {
  if (isOfficial) {
    return <span>{grade}</span>;
  }

  const predictedStyle = {
    fontStyle: 'italic',
    background: 'var(--color-background)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-1) var(--space-2)',
    color: 'var(--color-text-secondary)',
    fontSize: 'inherit',
    cursor: 'help',
  };

  return (
    <span
      style={predictedStyle}
      aria-label={`Predicted grade: ${grade}`}
      title="Predicted — based on mock/trial sitting(s)"
    >
      ~{grade}
    </span>
  );
}

export default PredictedGradeBadge;
