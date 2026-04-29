import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { exportErrorCSV } from '../../api/entities';

const cardStyle = {
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)',
  padding: 'var(--space-6)',
};

const bannerStyle = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 'var(--space-4)',
};

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
  fontSize: 'var(--font-size-md)',
  color: 'var(--color-text-primary)',
};

const errorRowStyle = {
  borderLeft: '3px solid #DC2626',
  background: 'rgba(220, 38, 38, 0.06)',
};

const sectionHeadingStyle = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-3)',
  marginTop: 'var(--space-4)',
};

const footerStyle = {
  display: 'flex',
  gap: 'var(--space-3)',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'var(--space-6)',
  paddingTop: 'var(--space-4)',
  borderTop: 'var(--border-width) solid var(--color-border)',
  flexWrap: 'wrap',
};

const DUPLICATE_OPTIONS = [
  { value: 'skip', label: 'Skip' },
  { value: 'overwrite', label: 'Overwrite existing' },
  { value: 'new', label: 'Import as new' },
];

export default function ValidationSummary({
  validationResult,
  entityName,
  onConfirm,
  onBack,
  isCommitting,
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [globalDuplicateChoice, setGlobalDuplicateChoice] = useState('skip');
  const [applyToAll, setApplyToAll] = useState(false);
  const [rowDuplicateChoices, setRowDuplicateChoices] = useState({});

  const validCount = validationResult?.valid_count ?? 0;
  const errorCount = validationResult?.error_count ?? 0;
  const warningCount = validationResult?.warning_count ?? 0;
  const errorRows = validationResult?.error_rows ?? [];
  const duplicateRows = validationResult?.duplicate_rows ?? [];

  const handleDownloadErrors = async () => {
    if (errorRows.length === 0) return;
    setIsDownloading(true);
    try {
      await exportErrorCSV(entityName, errorRows);
    } catch {
      // Download errors are non-fatal; browser may have already handled it
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDuplicateChoice = (rowIndex, choice) => {
    setRowDuplicateChoices((prev) => ({ ...prev, [rowIndex]: choice }));
  };

  return (
    <div style={cardStyle}>
      {/* Summary banner */}
      <div role="alert" style={bannerStyle}>
        <Badge variant="default" style={{ background: '#16A34A', color: '#fff' }}>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{validCount} valid</span>
        </Badge>
        {errorCount > 0 && (
          <Badge variant="destructive">
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge style={{ background: '#D97706', color: '#fff' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
          </Badge>
        )}
      </div>

      {/* Error rows table */}
      {errorRows.length > 0 && (
        <>
          <div style={sectionHeadingStyle}>Rows with errors</div>
          <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto', marginBottom: 'var(--space-3)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Row #</th>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((row, idx) => (
                  <tr key={idx} style={errorRowStyle}>
                    <td style={tdStyle}>{row.row_number ?? idx + 1}</td>
                    <td style={tdStyle}>{row.field ?? ''}</td>
                    <td style={tdStyle}>{row.value !== undefined ? String(row.value) : ''}</td>
                    <td style={tdStyle}>{row.error_reason ?? row.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadErrors}
            style={{
              background: 'none',
              border: 'none',
              cursor: isDownloading ? 'wait' : 'pointer',
              color: '#DC2626',
              fontSize: 'var(--font-size-sm)',
              padding: 0,
              fontFamily: 'var(--font-family-base)',
              textDecoration: 'underline',
            }}
          >
            {isDownloading ? 'Downloading…' : 'Download error rows as CSV'}
          </button>
        </>
      )}

      {/* Duplicate rows section */}
      {duplicateRows.length > 0 && (
        <>
          <div style={sectionHeadingStyle}>Duplicate rows ({duplicateRows.length})</div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
              />
              Apply this choice to all duplicates:
              <select
                value={globalDuplicateChoice}
                onChange={(e) => setGlobalDuplicateChoice(e.target.value)}
                style={{ fontSize: 'var(--font-size-sm)', padding: '2px var(--space-2)', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-width) solid var(--color-border)' }}
              >
                {DUPLICATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {duplicateRows.map((row, idx) => {
              const choice = applyToAll ? globalDuplicateChoice : (rowDuplicateChoices[idx] ?? 'skip');
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-background)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'var(--border-width) solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>
                    Row {row.row_number ?? idx + 1}
                    {row.identifier ? `: ${row.identifier}` : ''}
                  </span>
                  {DUPLICATE_OPTIONS.map((opt) => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: applyToAll ? 'not-allowed' : 'pointer', opacity: applyToAll ? 0.5 : 1 }}>
                      <input
                        type="radio"
                        name={`dup-${idx}`}
                        value={opt.value}
                        checked={choice === opt.value}
                        disabled={applyToAll}
                        onChange={() => handleDuplicateChoice(idx, opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={footerStyle}>
        <Button variant="outline" onClick={onBack} disabled={isCommitting}>
          Back
        </Button>
        <Button
          variant="default"
          disabled={validCount === 0 || isCommitting}
          onClick={onConfirm}
        >
          {isCommitting ? 'Importing…' : `Import ${validCount} Valid Row${validCount !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
