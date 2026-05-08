import { useState } from 'react';
import { FIELD_COMPONENT_MAP } from './fieldComponents.jsx';
import { Button } from '@schoolchoice/ui';

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-sm)',
  fontSize: 'var(--font-size-md)',
  fontFamily: 'var(--font-family-base)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
};

export default function EntityForm({ schema, initialValues = {}, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    for (const field of schema?.fields ?? []) {
      if (field.required && (form[field.name] === undefined || form[field.name] === null || form[field.name] === '')) {
        newErrors[field.name] = `${field.name} is required.`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {schema?.fields?.map((field) => {
        const FieldComponent = FIELD_COMPONENT_MAP[field.type] ?? FIELD_COMPONENT_MAP.string;
        return (
          <div key={field.name} style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor={field.name}
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {field.name}{field.required && ' *'}
            </label>
            <FieldComponent
              field={field}
              value={form[field.name]}
              onChange={(v) => setForm((prev) => ({ ...prev, [field.name]: v }))}
              inputStyle={inputStyle}
            />
            {errors[field.name] && (
              <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                {errors[field.name]}
              </p>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <Button label={saving ? 'Saving...' : 'Save'} variant="primary" type="submit" disabled={saving} />
        {onCancel && <Button label="Cancel" variant="secondary" onClick={onCancel} disabled={saving} />}
      </div>
    </form>
  );
}
