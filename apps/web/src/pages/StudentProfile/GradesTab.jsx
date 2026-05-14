import { useGradesTab } from '../../hooks/useGradesTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { PredictedGradeBadge } from '@schoolchoice/ui';
import { FileUpload } from '@schoolchoice/ui';

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

export default function GradesTab({ studentId, subjects }) {
  const { t } = useTranslation();
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
  } = useGradesTab(studentId);

  if (loading) return <LoadingSpinner label={t('grades.loading')} />;
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
          {t('grades.uploadTranscript')}
        </p>
        <FileUpload
          onFile={handleUpload}
          accept=".pdf,.jpg,.jpeg,.png"
          loading={transcriptState === 'parsing'}
          progress={uploadProgress}
        />
        {transcriptState === 'parsing' && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            {t('grades.transcriptParsing')}
          </p>
        )}
      </div>

      {parsedGrades.length > 0 && (
        <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)' }}>
          <p style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-3)' }}>{t('grades.parsedReview')}</p>
          {parsedGrades.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>{g.subject} — Grade: {g.grade} (Confidence: {g.confidence})</span>
              <Button onClick={() => handleAcceptSuggestion(g)}>{t('grades.accept')}</Button>
              <Button variant="secondary" onClick={() => dismissParsedGrade(i)}>{t('grades.dismiss')}</Button>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>{t('grades.subject')}</th>
              <th style={thStyle}>{t('grades.sitting')}</th>
              <th style={thStyle}>{t('grades.year')}</th>
              <th style={thStyle}>{t('grades.grade')}</th>
              <th style={thStyle}>{t('grades.predictedGrade')}</th>
              <th style={thStyle}>{t('grades.transcript')}</th>
              <th style={thStyle}>{t('grades.notes')}</th>
              <th style={thStyle}>{t('grades.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'var(--color-surface)' }}>{g.subject_name || g.subject_code}</td>
                <td style={tdStyle}>{g.sitting}</td>
                <td style={tdStyle}>{g.year_of_exam || '\u2014'}</td>
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
                    {t('grades.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!newRow ? (
        <div>
          <Button variant="secondary" onClick={() => setNewRow({ subject_name: '', sitting: 'MOCK', raw_grade: '', notes: '' })}>{t('grades.addGrade')}</Button>
        </div>
      ) : (
        <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-primary)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>{t('grades.newGradeEntry')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '2 1 200px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('grades.subject')}</label>
              <select
                value={newRow.subject_name || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, subject_name: e.target.value }))}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Subject"
              >
                <option value="">{t('grades.selectSubject')}</option>
                {(subjects && subjects.length > 0 ? subjects : HKDSE_SUBJECTS).map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 120px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('grades.sitting')}</label>
              <select
                value={newRow.sitting || 'MOCK'}
                onChange={(e) => setNewRow((r) => ({ ...r, sitting: e.target.value }))}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Sitting type"
              >
                <option value="MOCK">{t('common.mock')}</option>
                <option value="TRIAL">{t('common.trial')}</option>
                <option value="OFFICIAL">{t('common.official')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 80px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('grades.year')}</label>
              <input
                type="number"
                value={newRow.year_of_exam || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, year_of_exam: e.target.value ? parseInt(e.target.value, 10) : null }))}
                placeholder={new Date().getFullYear()}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Year of exam"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 100px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('grades.grade')}</label>
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
              <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('grades.notesOptional')}</label>
              <input
                value={newRow.notes || ''}
                onChange={(e) => setNewRow((r) => ({ ...r, notes: e.target.value }))}
                placeholder={t('grades.notes')}
                style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '100%' }}
                aria-label="Notes"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button onClick={handleSaveNewRow}>{t('grades.saveGrade')}</Button>
            <Button variant="secondary" onClick={() => setNewRow(null)}>{t('grades.cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
