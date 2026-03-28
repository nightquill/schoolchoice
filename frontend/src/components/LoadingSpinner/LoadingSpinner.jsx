function LoadingSpinner({ label = 'Loading\u2026' }) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-6) 0' }}
    >
      {label}
    </p>
  );
}

export default LoadingSpinner;
