import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@schoolchoice/ui/primitives/card';
import { Button } from '@schoolchoice/ui/primitives/button';
import { FileUpload } from '@schoolchoice/ui';
import { ColumnMapper } from '@schoolchoice/ui';
import ValidationSummary from '../ValidationSummary/ValidationSummary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@schoolchoice/ui/primitives/select';
import { importParse, importParseSheet, importValidate, importCommit } from '../../api/entities';
import { useTranslation } from '@schoolchoice/ui/i18n';

function useSteps() {
  const { t } = useTranslation();
  return [
    { key: 'upload', label: t('importWizard.uploadFile'), number: 1 },
    { key: 'sheetSelect', label: t('importWizard.selectSheet'), number: 2 },
    { key: 'columnMapping', label: t('importWizard.mapColumns'), number: 3 },
    { key: 'validationPreview', label: t('importWizard.reviewAndImport'), number: 4 },
  ];
}

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
  const { t } = useTranslation();
  const STEPS = useSteps();
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  // Hide sheetSelect from indicator since it only shows for Excel
  const visibleSteps = STEPS.filter((s) => s.key !== 'sheetSelect');

  return (
    <nav aria-label={t('importWizard.wizardSteps')} style={stepIndicatorStyle}>
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
  const { t } = useTranslation();
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
    onError: () => toast.error(t('importWizard.parseFailed')),
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
    onError: () => toast.error(t('importWizard.sheetFailed')),
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      importValidate(entityName, { mapping, rows: parseResult?.all_rows ?? [] }),
    onSuccess: (data) => {
      setValidationResult(data);
      setStep('validationPreview');
    },
    onError: () => toast.error(t('importWizard.validationFailed')),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      importCommit(entityName, {
        valid_rows: validationResult?.valid_rows ?? [],
        mapping,
        duplicate_decisions: {},
      }),
    onSuccess: (data) => {
      toast.success(t('importWizard.importedRows', { count: data.imported_count }));
      setStep('done');
    },
    onError: () => toast.error(t('importWizard.importFailed')),
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
            {t('importWizard.uploadDesc', { entityName })}
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
              {parseMutation.isPending ? t('importWizard.parsing') : t('common.next')}
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
            {t('importWizard.multipleSheets')}
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
              {t('importWizard.sheet')}
            </label>
            <Select
              value={selectedSheet}
              onValueChange={(val) => setSelectedSheet(val)}
            >
              <SelectTrigger style={{ minWidth: '200px' }}>
                <SelectValue placeholder={t('importWizard.selectASheet')} />
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
              {t('common.back')}
            </Button>
            <Button
              variant="default"
              disabled={!selectedSheet || parseSheetMutation.isPending}
              onClick={() => parseSheetMutation.mutate({ f: file, sheet: selectedSheet })}
            >
              {parseSheetMutation.isPending ? t('importWizard.loading') : t('common.next')}
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
            {t('importWizard.mapDesc', { entityName })}
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
              {t('common.back')}
            </Button>
            <Button
              variant="default"
              disabled={validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
            >
              {validateMutation.isPending ? t('importWizard.validating') : t('common.next')}
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
            {t('importWizard.importComplete')}
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {t('importWizard.importedDesc', { entityName })}
          </p>
          <Button variant="default" onClick={() => navigate(`/entities/${entityName}`)}>
            {t('importWizard.goToList')}
          </Button>
        </div>
      )}
    </div>
  );
}
