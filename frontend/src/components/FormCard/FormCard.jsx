function FormCard({ children, title }) {
  const cardStyle = {
    maxWidth: '400px',
    margin: 'auto',
    padding: 'var(--space-6)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--border-radius-md)',
    border: 'var(--border-width) solid var(--color-border)',
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-6)',
  };

  return (
    <div style={cardStyle} role="region" aria-label={title || undefined}>
      {title && <h2 style={titleStyle}>{title}</h2>}
      {children}
    </div>
  );
}

export default FormCard;
