import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { getAccount } from '@schoolchoice/ui/api/account';
import { previewImport, commitImport } from '../../api/studentImport';

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
  const navigate = useNavigate();
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
      toast.success('Import completed successfully');
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
        <h1 style={headingStyle}>Import Students</h1>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
          {['Upload File', 'Preview & Confirm', 'Done'].map((label, i) => (
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
                Accepted formats: <strong>CSV</strong> (.csv) and <strong>Excel</strong> (.xlsx)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Required columns:</strong> candidate_number, name
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Grade columns:</strong> CHLA, ENGL, MATH, CSD, PHYS, CHEM, BIOL, ECON, HIST, GEOG, ICT, M1, M2 (use HKDSE grades: 5**, 5*, 5, 4, 3, 2, 1, U, A, AD)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
                <strong>Sitting columns:</strong> sitting (MOCK / TRIAL / OFFICIAL), year_of_exam (e.g. 2025)
              </p>
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                Existing students matched by candidate_number -- new numbers auto-create, existing numbers update data.
              </p>
              <a
                href="/data/sample-students.csv"
                download="sample-students.csv"
                style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', textDecoration: 'underline' }}
              >
                Download sample CSV (10 students with grades)
              </a>
            </div>

            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
              {previewLoading ? (
                <LoadingSpinner label="Analysing file..." />
              ) : (
                <>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    Select a CSV or Excel file to import students
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
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>New Students</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#1e40af' }}>
                  {summary.updated ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Updates</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#991b1b' }}>
                  {summary.errors ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Errors</p>
              </div>
              <div style={summaryCardStyle}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                  {summary.grades ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Grades</p>
              </div>
            </div>

            {/* Preview table */}
            <div style={{ ...cardStyle, overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Row</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Candidate #</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Grades</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Notes</th>
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
                        No rows found in file
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button onClick={handleCommit} disabled={commitLoading || (summary.errors > 0 && summary.new === 0 && summary.updated === 0)}>
                {commitLoading ? 'Importing...' : 'Confirm Import'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={commitLoading}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>&#10003;</div>
            <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              Import Complete
            </h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {commitResult?.created ?? 0} students created, {commitResult?.updated ?? 0} updated, {commitResult?.grades ?? 0} grades recorded.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
