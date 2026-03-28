function ErrorMessage({ message }) {
  return (
    <p
      role="alert"
      style={{
        color: 'var(--color-error)',
        fontSize: 'var(--font-size-sm)',
        padding: 'var(--space-3) var(--space-4)',
        border: 'var(--border-width) solid var(--color-error)',
        borderRadius: 'var(--border-radius-sm)',
        background: 'rgba(220,38,38,0.08)',
        marginBottom: 'var(--space-4)',
      }}
    >
      {message}
    </p>
  );
}

export default ErrorMessage;
