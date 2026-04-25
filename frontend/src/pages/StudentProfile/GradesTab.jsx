import { useGradesTab } from '../../hooks/useGradesTab';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import Button from '../../components/Button/Button';
import PredictedGradeBadge from '../../components/PredictedGradeBadge/PredictedGradeBadge';
import FileUpload from '../../components/FileUpload/FileUpload';

const HKDSE_SUBJECTS = [
  { code: 'CHLA', name: 'Chinese Language' },
  { code: 'ENGL', name: 'English Language' },
  { code: 'MATH', name: 'Mathematics (Compulsory Part)' },
  { code: 'CSD',  name: 'Citizenship and Social Development' },
  { code: 'CHIH', name: 'Chinese History' },
  { code: 'CHIL', name: 'Chinese Literature' },
  { code: 'HIST', name: 'History' },
  { code: 'GEOG', name: 'Geography' },
  { code: 'TOUR', name: 'Tourism and Hospitality Studies' },
  { code: 'VART', name: 'Visual Arts' },
  { code: 'MUSC', name: 'Music' },
  { code: 'ERS',  name: 'Ethics and Religious Studies' },
  { code: 'PE',   name: 'Physical Education' },
  { code: 'ECON', name: 'Economics' },
  { code: 'BAFS', name: 'Business, Accounting and Financial Studies' },
  { code: 'BIOL', name: 'Biology' },
  { code: 'CHEM', name: 'Chemistry' },
  { code: 'PHYS', name: 'Physics' },
  { code: 'CSCI', name: 'Combined Science' },
  { code: 'ISCI', name: 'Integrated Science' },
  { code: 'M1',   name: 'Mathematics Extended Module 1 (M1)' },
  { code: 'M2',   name: 'Mathematics Extended Module 2 (M2)' },
  { code: 'ICT',  name: 'Information and Communication Technology' },
  { code: 'DAT',  name: 'Design and Applied Technology' },
  { code: 'HMSC', name: 'Health Management and Social Care' },
  { code: 'TL',   name: 'Technology and Living' },
  { code: 'FREN', name: 'French' },
  { code: 'GERM', name: 'German' },
  { code: 'JAPA', name: 'Japanese' },
  { code: 'SPAN', name: 'Spanish' },
  { code: 'PTH',  name: 'Putonghua' },
  { code: 'APL_GENERIC', name: 'Applied Learning (Generic)' },
];

const HKDSE_GRADES = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];

export default function GradesTab({ studentId, showToast, subjects }) {
  const {
    grades,
    loading,
    error,
    newRow,
    setNewRow,
    transcriptState,
    parsedGrades,
    uploadProgress,
    handleUpload,
    handleAcceptSuggestion,
    handleDeleteGrade,
    handleSaveNewRow,
    dismissParsedGrade,
  } = useGradesTab(studentId, showToast);

  if (loading) return <LoadingSpinner label="Loading grades..." />;
  if (error) return <ErrorMessage message={error} />;

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'auto',
    display: 'block',
  };

  const thStyle = {
    background: 'var(--color-background)',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
          Upload Transcript (PDF or image, max 10 MB)
        </p>
        <FileUpload
          onFile={handleUpload}
          accept=".pdf,.jpg,.jpeg,.png"
          loading={transcriptState === 'parsing'}
          progress={uploadProgress}
        />
        {transcriptState === 'parsing' && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            Transcript uploaded. Parsing in progress{'\u2026'}
          </p>
        )}
      </div>

      {parsedGrades.length > 0 && (
        <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)' }}>
          <p style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-3)' }}>Parsed Grades Review</p>
          {parsedGrades.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>{g.subject} — Grade: {g.grade} (Confidence: {g.confidence})</span>
              <Button label="Accept" variant="primary" onClick={() => handleAcceptSuggestion(g)} />
              <Button label="Dismiss" variant="secondary" onClick={() => dismissParsedGrade(i)} />
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Subject</th>
              <th style={thStyle}>Sitting</th>
              <th style={thStyle}>Grade</th>
              <th style={thStyle}>Predicted Grade</th>
              <th style={thStyle}>Transcript</th>
              <th style={thStyle}>Notes</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'var(--color-surface)' }}>{g.subject_name || g.subject_code}</td>
                <td style={tdStyle}>{g.sitting}</td>
                <td style={tdStyle}>{g.raw_grade}</td>
                <td style={tdStyle}>
                  {g.predicted_grade && g.sitting !== 'OFFICIAL' ? (
                    <PredictedGradeBadge grade={g.predicted_grade} isOfficial={false} />
                  ) : g.sitting === 'OFFICIAL' ? (
                    <PredictedGradeBadge grade={g.raw_grade} isOfficial={true} />
                  ) : '\u2014'}
                </td>
                <td style={tdStyle}>{g.transcript_uploaded ? '\u2713' : ''}</td>
                <td style={tdStyle}>{g.notes}</td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleDeleteGrade(g.id)}
                    style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                    aria-label={`Delete grade for ${g.subject_name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!newRow ? (
        <div>
          <Button label="Add Grade" variant="secondary" onClick={() => setNewRow({ subject_name: '', sitting: 'MOCK', raw_grade: '', notes: '' })} />
        </div>
      ) : (
        <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-primary)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>New Grade Entry</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '2 1 200px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Subject</label>
              <select
                value={newRow.subject_name || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, subject_name: e.target.value }))}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Subject"
              >
                <option value="">Select subject{'\u2026'}</option>
                {(subjects && subjects.length > 0 ? subjects : HKDSE_SUBJECTS).map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 120px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Sitting</label>
              <select
                value={newRow.sitting || 'MOCK'}
                onChange={(e) => setNewRow((r) => ({ ...r, sitting: e.target.value }))}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Sitting type"
              >
                <option value="MOCK">MOCK</option>
                <option value="TRIAL">TRIAL</option>
                <option value="OFFICIAL">OFFICIAL</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 100px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Grade</label>
              <select
                value={newRow.raw_grade || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, raw_grade: e.target.value }))}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Grade"
              >
                <option value="">{'\u2014'}</option>
                {HKDSE_GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '2 1 160px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Notes (optional)</label>
              <input
                value={newRow.notes || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, notes: e.target.value }))}
                placeholder="Notes"
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Notes"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button label="Save Grade" variant="primary" onClick={handleSaveNewRow} />
            <Button label="Cancel" variant="secondary" onClick={() => setNewRow(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
