import { useTranslation } from '@schoolchoice/ui/i18n';

export const FIELD_COMPONENT_MAP = {
  string: ({ field, value, onChange, inputStyle }) => (
    <input
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      maxLength={field.max_length || undefined}
      style={inputStyle}
    />
  ),
  text: ({ field, value, onChange, inputStyle }) => (
    <textarea
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      style={{ ...inputStyle, resize: 'vertical' }}
    />
  ),
  int: ({ field, value, onChange, inputStyle }) => (
    <input
      type="number"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      style={inputStyle}
    />
  ),
  decimal: ({ field, value, onChange, inputStyle }) => (
    <input
      type="number"
      step="0.01"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      style={inputStyle}
    />
  ),
  date: ({ field, value, onChange, inputStyle }) => (
    <input
      type="date"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  ),
  datetime: ({ field, value, onChange, inputStyle }) => (
    <input
      type="datetime-local"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  ),
  boolean: ({ field, value, onChange }) => (
    <input
      type="checkbox"
      id={field.name}
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
    />
  ),
  enum: function EnumField({ field, value, onChange, inputStyle }) {
    const { t } = useTranslation();
    return (
      <select
        id={field.name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">{t('entityForm.selectPlaceholder')}</option>
        {field.choices?.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    );
  },
  jsonb: ({ field, value, onChange, inputStyle }) => (
    <textarea
      id={field.name}
      value={value ? JSON.stringify(value, null, 2) : ''}
      onChange={(e) => {
        try { onChange(JSON.parse(e.target.value)); } catch { /* let user keep typing */ }
      }}
      rows={6}
      style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
    />
  ),
};
