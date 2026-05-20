function TextInput({ label, name, value, onChange, type = 'text', error, required = false, placeholder }) {
  const inputId = `input-${name}`;
  const errorId = `error-${name}`;

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 'var(--space-2)',
    border: `var(--border-width) solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-family-base)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-1)',
  };

  const errorStyle = {
    display: 'block',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-error)',
    marginTop: 'var(--space-1)',
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label htmlFor={inputId} style={labelStyle}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        placeholder={placeholder}
        style={inputStyle}
      />
      {error && (
        <span id={errorId} style={errorStyle} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default TextInput;
