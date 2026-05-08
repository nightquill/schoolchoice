import { CheckIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)',
  overflow: 'hidden',
};

const thStyle = {
  background: 'var(--color-background)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  borderBottom: 'var(--border-width) solid var(--color-border)',
};

const tdStyle = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  verticalAlign: 'top',
};

const colLabelStyle = {
  fontSize: '14px',
  fontWeight: '500',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-1)',
};

const previewValueStyle = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  fontFamily: 'monospace',
  margin: '2px 0',
};

const sectionTitleStyle = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  marginBottom: 'var(--space-3)',
};

function FieldSelect({ fileCol, entityFields, mapping, usedFields, autoMapping, onMappingChange }) {
  const currentValue = mapping[fileCol] ?? '';
  const isAutoMapped = !!(autoMapping[fileCol] && autoMapping[fileCol] === currentValue);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <Select
        value={currentValue}
        onValueChange={(val) => {
          onMappingChange({ ...mapping, [fileCol]: val || null });
        }}
      >
        <SelectTrigger style={{ minWidth: '200px', width: '100%' }}>
          <SelectValue placeholder="Do not import" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Do not import</SelectItem>
          {entityFields.map((field) => (
            <SelectItem
              key={field}
              value={field}
              disabled={usedFields.has(field) && mapping[fileCol] !== field}
            >
              {field}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAutoMapped && (
        <CheckIcon size={16} style={{ color: '#16A34A', flexShrink: 0 }} aria-label="Auto-mapped" />
      )}
    </div>
  );
}

export default function ColumnMapper({
  columns,
  previewRows,
  autoMapping,
  entityFields,
  mapping,
  onMappingChange,
}) {
  // Build set of entity fields currently used in mapping (excluding null/empty)
  const usedFields = new Set(
    Object.values(mapping).filter((v) => v && v !== '')
  );

  // Split columns into mapped and unmapped
  const mappedColumns = columns.filter((col) => mapping[col] && mapping[col] !== '');
  const unmappedColumns = columns.filter((col) => !mapping[col] || mapping[col] === '');

  function getPreviewValues(col) {
    return previewRows
      .slice(0, 3)
      .map((row) => (row[col] !== undefined && row[col] !== null ? String(row[col]) : ''))
      .filter((v) => v !== '');
  }

  function renderColumnRow(col) {
    const preview = getPreviewValues(col);
    return (
      <tr key={col}>
        <td style={tdStyle}>
          <div style={colLabelStyle}>{col}</div>
          {preview.map((val, i) => (
            <div key={i} style={previewValueStyle}>
              {val}
            </div>
          ))}
          {preview.length === 0 && (
            <div style={{ ...previewValueStyle, fontStyle: 'italic' }}>no preview</div>
          )}
        </td>
        <td style={tdStyle}>
          <FieldSelect
            fileCol={col}
            entityFields={entityFields}
            mapping={mapping}
            usedFields={usedFields}
            autoMapping={autoMapping}
            onMappingChange={onMappingChange}
          />
        </td>
      </tr>
    );
  }

  return (
    <div>
      {mappedColumns.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '50%' }}>File column</th>
              <th style={thStyle}>Maps to field</th>
            </tr>
          </thead>
          <tbody>{mappedColumns.map(renderColumnRow)}</tbody>
        </table>
      )}

      {unmappedColumns.length > 0 && (
        <>
          <div style={{ margin: 'var(--space-4) 0' }}>
            <Separator />
          </div>
          <div style={sectionTitleStyle}>Not imported</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '50%' }}>File column</th>
                <th style={thStyle}>Maps to field</th>
              </tr>
            </thead>
            <tbody>{unmappedColumns.map(renderColumnRow)}</tbody>
          </table>
        </>
      )}

      {columns.length === 0 && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          No columns detected in the uploaded file.
        </p>
      )}
    </div>
  );
}
