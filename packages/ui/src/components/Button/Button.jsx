function Button({ label, onClick, variant = 'primary', disabled = false, loading = false, type = 'button' }) {
  const isDisabled = disabled || loading;

  const baseStyle = {
    fontFamily: 'var(--font-family-base)',
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-medium)',
    padding: 'var(--space-3) var(--space-5)',
    borderRadius: 'var(--border-radius-md)',
    border: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    lineHeight: 'var(--line-height-tight)',
  };

  const variantStyles = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-surface)',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--color-text-primary)',
      border: 'var(--border-width) solid var(--color-border)',
    },
    danger: {
      background: 'var(--color-error)',
      color: 'var(--color-surface)',
      border: 'none',
    },
  };

  const style = { ...baseStyle, ...variantStyles[variant] };

  return (
    <button
      type={type}
      style={style}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      aria-label={loading ? `${label}, loading` : label}
    >
      {loading ? 'Loading…' : label}
    </button>
  );
}

export default Button;
