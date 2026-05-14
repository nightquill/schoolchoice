import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { getAccount } from '@schoolchoice/ui/api/account';
import { previewImport, commitImport } from '../../api/studentImport';
import { useTranslation } from '@schoolchoice/ui/i18n';

const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
};

const contentStyle = {
  paddingTop: 'var(--space-6)',
  paddingBottom: 'var(--space-6)',
};

const headingStyle = {
  fontSize: '24px',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-4)',
};

const cardStyle = {
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)',
  padding: 'var(--space-4)',
};

const infoBoxStyle = {
  ...cardStyle,
  marginBottom: 'var(--space-4)',
  fontSize: 'var(--font-size-sm)',
};

const summaryCardStyle = {
  ...cardStyle,
  textAlign: 'center',
  flex: '1 1 120px',
};

const badgeBase = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--border-radius-sm)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
};

const badges = {
  new: { ...badgeBase, background: '#dcfce7', color: '#166534' },
  update: { ...badgeBase, background: '#dbeafe', color: '#1e40af' },
  error: { ...badgeBase, background: '#fee2e2', color: '#991b1b' },
  skip: { ...badgeBase, background: '#f3f4f6', color: '#6b7280' },
};

export default function StudentImport() {
  const { t } = useTranslation();  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data ?? null;

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewLoading(true);
    try {
      const data = await previewImport(selected);
      setPreview(data);
      setStep(2);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Preview failed';
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitLoading(true);
    try {
      const data = await commitImport(file);
      setCommitResult(data);
      setStep(3);
      toast.success(t('import.importSuccess'));
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Import failed';
      toast.error(msg);
    } finally {
      setCommitLoading(false);
    }
  };

  const handleCancel = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const rows = preview?.rows ?? [];
  const summary = preview?.summary ?? {};

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <main id="main-content" className="px-4 md:px-8" style={contentStyle}>
        <h1 style={headingStyle}>{t('onboarding.importStudents')}</h1>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
          {[t('import.uploadFile'), t('import.previewConfirm'), t('import.done')].map((label, i) => (
            <span
              key={label}
              style={{
                fontWeight: step === i + 1 ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                color: step === i + 1 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <>
            <div style={infoBoxStyle}>
              <p style={{ margin: '0 0 var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
                {t('import.acceptedFormats')} <strong>CSV</strong> (.csv) &amp; <strong>Excel</strong> (.xlsx)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.requiredColumns')}</strong> {t('import.requiredColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.gradeColumns')}</strong> {t('import.gradeColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>{t('import.sittingColumns')}</strong> {t('import.sittingColumnsList')}
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                {t('import.matchByCandidateNumber')}
              </p>
              <a
                href="/data/sample-students.csv"
                download="sample-students.csv"
                style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', textDecoration: 'underline' }}
              >
                {t('import.downloadSample')}
              </a>
            </div>

            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
              {previewLoading ? (
                <LoadingSpinner label={t('import.analysing')} />
              ) : (
                <>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    {t('import.selectFile')}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 2 && preview && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#166534' }}>
                  {summary.new ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('import.newStudents')}</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#1e40af' }}>
                  {summary.updated ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('import.updates')}</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#991b1b' }}>
                  {summary.errors ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('import.errors')}</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                  {summary.grades ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('import.gradesCount')}</p>
              </div>
            </div>

            {/* Preview table */}
            <div style={{ ...cardStyle, overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.row')}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.status')}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.candidateHash')}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.name')}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.gradesCol')}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>{t('import.notesCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const status = (row.status || 'skip').toLowerCase();
                    const badge = badges[status] || badges.skip;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{row.row ?? idx + 1}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <span style={badge}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>{row.candidate_number ?? '-'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{row.name ?? '-'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{row.grades_summary ?? '-'}</td>
                        <td style={{ padding: 'var(--space-2)', color: status === 'error' ? '#991b1b' : 'var(--color-text-secondary)' }}>
                          {(row.warnings || row.errors || []).join('; ') || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        {t('import.noRowsFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button onClick={handleCommit} disabled={commitLoading || (summary.errors > 0 && summary.new === 0 && summary.updated === 0)}>
                {commitLoading ? t('import.importing') : t('import.confirmImport')}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={commitLoading}>
                {t('common.cancel')}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>&#10003;</div>
            <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {t('import.importComplete')}
            </h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {t('import.studentsCreated', { created: commitResult?.created ?? 0, updated: commitResult?.updated ?? 0, grades: commitResult?.grades ?? 0 })}
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              {t('import.backToDashboard')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
