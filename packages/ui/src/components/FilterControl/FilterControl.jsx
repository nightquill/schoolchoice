import { Input } from '../ui/input';

const selectStyle = {
  height: '44px',
  padding: '0 var(--space-3)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-sm)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-base)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  minWidth: '140px',
};

const inputStyle = {
  height: '44px',
  width: 80,
  minHeight: '44px',
};

const dateInputStyle = {
  height: '44px',
  minHeight: '44px',
  width: 'auto',
};

/**
 * Polymorphic filter control driven by entity schema field type.
 *
 * Props:
 *   field   — { name, type, choices } from entity schema
 *   value   — current filter value (null | string | { from, to } | { min, max })
 *   onChange — callback(newValue)
 */
export default function FilterControl({ field, value, onChange }) {
  if (field.type === 'enum') {
    return (
      <select
        aria-label={field.name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">All {field.name}</option>
        {(field.choices ?? []).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'date') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <Input
          type="date"
          aria-label={`${field.name} from`}
          value={value?.from ?? ''}
          onChange={(e) => onChange({ ...(value ?? {}), from: e.target.value || undefined })}
          style={dateInputStyle}
          placeholder="From"
        />
        <Input
          type="date"
          aria-label={`${field.name} to`}
          value={value?.to ?? ''}
          onChange={(e) => onChange({ ...(value ?? {}), to: e.target.value || undefined })}
          style={dateInputStyle}
          placeholder="To"
        />
      </div>
    );
  }

  if (field.type === 'int' || field.type === 'decimal') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <Input
          type="number"
          aria-label={`${field.name} min`}
          value={value?.min ?? ''}
          onChange={(e) => onChange({ ...(value ?? {}), min: e.target.value || undefined })}
          style={inputStyle}
          placeholder="Min"
        />
        <Input
          type="number"
          aria-label={`${field.name} max`}
          value={value?.max ?? ''}
          onChange={(e) => onChange({ ...(value ?? {}), max: e.target.value || undefined })}
          style={inputStyle}
          placeholder="Max"
        />
      </div>
    );
  }

  // text and unknown types: handled by global search only
  return null;
}
