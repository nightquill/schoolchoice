function EmptyState({ message }) {
  return (
    <p
      style={{
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        padding: 'var(--space-6)',
        fontSize: 'var(--font-size-md)',
        lineHeight: 'var(--line-height-normal)',
      }}
    >
      {message}
    </p>
  );
}

export default EmptyState;
