import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import FileUpload from '../FileUpload/FileUpload';
import ColumnMapper from '../ColumnMapper/ColumnMapper';
import ValidationSummary from '../ValidationSummary/ValidationSummary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { importParse, importParseSheet, importValidate, importCommit } from '../../api/entities';

const STEPS = [
  { key: 'upload', label: 'Upload File', number: 1 },
  { key: 'sheetSelect', label: 'Select Sheet', number: 2 },
  { key: 'columnMapping', label: 'Map Columns', number: 3 },
  { key: 'validationPreview', label: 'Review and Import', number: 4 },
];

const stepIndicatorStyle = {
  display: 'flex',
  gap: 'var(--space-4)',
  marginBottom: 'var(--space-6)',
  alignItems: 'center',
};

const stepItemStyle = (isActive, isComplete) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  color: isActive
    ? 'var(--color-primary, #2563EB)'
    : isComplete
    ? 'var(--color-text-secondary)'
    : 'var(--color-text-secondary)',
  fontWeight: isActive ? 'var(--font-weight-medium)' : 'normal',
  fontSize: 'var(--font-size-sm)',
});

const stepCircleStyle = (isActive, isComplete) => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 'var(--font-weight-medium)',
  background: isActive
    ? 'var(--color-primary, #2563EB)'
    : isComplete
    ? 'var(--color-text-secondary)'
    : 'var(--color-border)',
  color: isActive || isComplete ? '#fff' : 'var(--color-text-secondary)',
  flexShrink: 0,
});

const stepDividerStyle = {
  flex: 1,
  height: '1px',
  background: 'var(--color-border)',
  maxWidth: '48px',
};

function StepIndicator({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  // Hide sheetSelect from indicator since it only shows for Excel
  const visibleSteps = STEPS.filter((s) => s.key !== 'sheetSelect');

  return (
    <nav aria-label="Import wizard steps" style={stepIndicatorStyle}>
      {visibleSteps.map((step, idx) => {
        const stepIndex = STEPS.findIndex((s) => s.key === step.key);
        const isActive = step.key === currentStep;
        const isComplete = stepIndex < currentIndex;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={stepItemStyle(isActive, isComplete)}
              aria-current={isActive ? 'step' : undefined}
            >
              <div style={stepCircleStyle(isActive, isComplete)}>{step.number}</div>
              <span>{step.label}</span>
            </div>
            {idx < visibleSteps.length - 1 && <div style={stepDividerStyle} />}
          </div>
        );
      })}
    </nav>
  );
}

export default function ImportWizard({ entityName, schema }) {
  const navigate = useNavigate();

  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);

  const entityFields = schema?.fields?.map((f) => f.name) ?? [];

  const parseMutation = useMutation({
    mutationFn: (f) => importParse(entityName, f),
    onSuccess: (data) => {
      setParseResult(data);
      // Initialize mapping from auto_mapping
      const initialMapping = {};
      (data.columns || []).forEach((col) => {
        initialMapping[col] = data.auto_mapping?.[col] ?? null;
      });
      setMapping(initialMapping);

      if (data.sheets && data.sheets.length > 1) {
        setSelectedSheet(data.selected_sheet || data.sheets[0]);
        setStep('sheetSelect');
      } else {
        setStep('columnMapping');
      }
    },
    onError: () => toast.error('Failed to parse file. Please check the file format and try again.'),
  });

  const parseSheetMutation = useMutation({
    mutationFn: ({ f, sheet }) => importParseSheet(entityName, f, sheet),
    onSuccess: (data) => {
      setParseResult(data);
      const initialMapping = {};
      (data.columns || []).forEach((col) => {
        initialMapping[col] = data.auto_mapping?.[col] ?? null;
      });
      setMapping(initialMapping);
      setStep('columnMapping');
    },
    onError: () => toast.error('Failed to load sheet. Please try again.'),
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      importValidate(entityName, { mapping, rows: parseResult?.all_rows ?? [] }),
    onSuccess: (data) => {
      setValidationResult(data);
      setStep('validationPreview');
    },
    onError: () => toast.error('Validation failed. Please check your column mapping and try again.'),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      importCommit(entityName, {
        valid_rows: validationResult?.valid_rows ?? [],
        mapping,
        duplicate_decisions: {},
      }),
    onSuccess: (data) => {
      toast.success(
        `Successfully imported ${data.imported_count} row${data.imported_count !== 1 ? 's' : ''}.`
      );
      setStep('done');
    },
    onError: () => toast.error('Import failed. Please try again.'),
  });

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-6)',
  };

  const footerStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
    marginTop: 'var(--space-6)',
    paddingTop: 'var(--space-4)',
    borderTop: 'var(--border-width) solid var(--color-border)',
  };

  return (
    <div>
      <StepIndicator currentStep={step} />

      {step === 'upload' && (
        <div style={cardStyle}>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-4)',
            }}
          >
            Upload a CSV or Excel file to import data into <strong>{entityName}</strong>.
          </p>
          <FileUpload
            accept=".csv,.xlsx,.xls"
            onFile={(f) => setFile(f)}
            loading={parseMutation.isPending}
          />
          <div style={footerStyle}>
            <Button
              variant="default"
              disabled={!file || parseMutation.isPending}
              onClick={() => parseMutation.mutate(file)}
            >
              {parseMutation.isPending ? 'Parsing…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {step === 'sheetSelect' && (
        <div style={cardStyle}>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-4)',
            }}
          >
            This Excel file contains multiple sheets. Select the sheet to import.
          </p>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-primary)',
              }}
            >
              Sheet
            </label>
            <Select
              value={selectedSheet}
              onValueChange={(val) => setSelectedSheet(val)}
            >
              <SelectTrigger style={{ minWidth: '200px' }}>
                <SelectValue placeholder="Select a sheet" />
              </SelectTrigger>
              <SelectContent>
                {(parseResult?.sheets ?? []).map((sheet) => (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div style={footerStyle}>
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              variant="default"
              disabled={!selectedSheet || parseSheetMutation.isPending}
              onClick={() => parseSheetMutation.mutate({ f: file, sheet: selectedSheet })}
            >
              {parseSheetMutation.isPending ? 'Loading…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {step === 'columnMapping' && (
        <div style={cardStyle}>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-4)',
            }}
          >
            Map the columns from your file to {entityName} fields. Auto-mapped columns are pre-filled.
          </p>
          <ColumnMapper
            columns={parseResult?.columns ?? []}
            previewRows={parseResult?.preview_rows ?? []}
            autoMapping={parseResult?.auto_mapping ?? {}}
            entityFields={entityFields}
            mapping={mapping}
            onMappingChange={setMapping}
          />
          <div style={footerStyle}>
            <Button
              variant="outline"
              onClick={() =>
                setStep(parseResult?.sheets?.length > 1 ? 'sheetSelect' : 'upload')
              }
            >
              Back
            </Button>
            <Button
              variant="default"
              disabled={validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
            >
              {validateMutation.isPending ? 'Validating…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {step === 'validationPreview' && (
        <ValidationSummary
          validationResult={validationResult}
          entityName={entityName}
          onConfirm={() => commitMutation.mutate()}
          onBack={() => setStep('columnMapping')}
          isCommitting={commitMutation.isPending}
        />
      )}

      {step === 'done' && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--space-8)' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: 'var(--space-4)',
            }}
          >
            &#10003;
          </div>
          <h2
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Import complete
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-6)',
            }}
          >
            Your data has been imported into {entityName}.
          </p>
          <Button variant="default" onClick={() => navigate(`/entities/${entityName}`)}>
            Go to list
          </Button>
        </div>
      )}
    </div>
  );
}
