import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGradesTab } from '../../hooks/useGradesTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { PredictedGradeBadge } from '@schoolchoice/ui';
import { FileUpload } from '@schoolchoice/ui';
import { getGradeBuilds, createGradeBuild, updateGradeBuild, deleteGradeBuild, scoreBuild } from '../../api/gradeBuilds';
import { toast } from 'sonner';

const HKDSE_SUBJECT_CODES = [
  'CHLA', 'ENGL', 'MATH', 'CSD', 'CHIH', 'CHIL', 'HIST', 'GEOG', 'TOUR',
  'VART', 'MUSC', 'ERS', 'PE', 'ECON', 'BAFS', 'BIOL', 'CHEM', 'PHYS',
  'CSCI', 'ISCI', 'M1', 'M2', 'ICT', 'DAT', 'HMSC', 'TL',
  'FREN', 'GERM', 'JAPA', 'SPAN', 'PTH', 'APL_GENERIC',
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

  // Grade builds state
  const [activeBuildId, setActiveBuildId] = useState(null); // null = actual grades
  const [buildGrades, setBuildGrades] = useState({});
  const [liveScores, setLiveScores] = useState([]);
  const [newBuildName, setNewBuildName] = useState('');
  const [showNewBuild, setShowNewBuild] = useState(false);

  const buildsQuery = useQuery({
    queryKey: ['grade-builds', studentId],
    queryFn: () => getGradeBuilds(studentId),
  });
  const builds = buildsQuery.data?.builds ?? [];
  const activeBuild = builds.find(b => b.id === activeBuildId);

  const scoreTimeoutRef = useRef(null);
  const fetchLiveScores = useCallback((buildId) => {
    if (scoreTimeoutRef.current) clearTimeout(scoreTimeoutRef.current);
    scoreTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await scoreBuild(studentId, buildId);
        setLiveScores(result.scores || []);
      } catch { /* ignore */ }
    }, 300);
  }, [studentId]);

  const handleCreateBuild = async () => {
    if (!newBuildName.trim()) return;
    try {
      const result = await createGradeBuild(studentId, newBuildName.trim());
      buildsQuery.refetch();
      setActiveBuildId(result.id);
      setBuildGrades(result.grades || {});
      setNewBuildName('');
      setShowNewBuild(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('grades.addFailed'));
    }
  };

  const handleBuildGradeChange = async (subjectCode, grade) => {
    const newGrades = { ...buildGrades, [subjectCode]: grade };
    setBuildGrades(newGrades);
    if (activeBuildId) {
      try {
        await updateGradeBuild(studentId, activeBuildId, { grades: newGrades });
        fetchLiveScores(activeBuildId);
      } catch { /* ignore */ }
    }
  };

  const handleDeleteBuild = async () => {
    if (!activeBuildId) return;
    try {
      await deleteGradeBuild(studentId, activeBuildId);
      setActiveBuildId(null);
      setBuildGrades({});
      setLiveScores([]);
      buildsQuery.refetch();
    } catch { toast.error(t('grades.deleteFailed')); }
  };

  useEffect(() => {
    if (activeBuildId && activeBuild) {
      setBuildGrades(activeBuild.grades || {});
      fetchLiveScores(activeBuildId);
    } else {
      setBuildGrades({});
      setLiveScores([]);
    }
  }, [activeBuildId]); // eslint-disable-line

  // Sitting filter — default to the sitting with most grades
  const sittingCounts = useMemo(() => {
    const counts = {};
    (grades || []).forEach((g) => { counts[g.sitting] = (counts[g.sitting] || 0) + 1; });
    return counts;
  }, [grades]);
  const availableSittings = useMemo(() => Object.keys(sittingCounts).sort(), [sittingCounts]);
  const defaultSitting = useMemo(() => {
    if (availableSittings.length === 0) return 'MOCK';
    return availableSittings.reduce((a, b) => (sittingCounts[a] >= sittingCounts[b] ? a : b));
  }, [availableSittings, sittingCounts]);
  const [sittingFilter, setSittingFilter] = useState(null); // null = use default
  const activeSitting = sittingFilter ?? defaultSitting;
  const filteredGrades = useMemo(() => (grades || []).filter((g) => g.sitting === activeSitting), [grades, activeSitting]);

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
      {/* Build selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <select
          value={activeBuildId || ''}
          onChange={(e) => setActiveBuildId(e.target.value || null)}
          style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
        >
          <option value="">{t('gradeBuilds.actualGrades')}</option>
          {builds.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {!showNewBuild && builds.length < 5 && (
          <button onClick={() => setShowNewBuild(true)} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-base)' }}>
            {t('gradeBuilds.newBuild')}
          </button>
        )}
        {showNewBuild && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input value={newBuildName} onChange={(e) => setNewBuildName(e.target.value)} placeholder={t('gradeBuilds.buildName')} style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-sm)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', width: '150px' }} onKeyDown={(e) => e.key === 'Enter' && handleCreateBuild()} />
            <Button onClick={handleCreateBuild}>{t('dashboard.create')}</Button>
            <button onClick={() => { setShowNewBuild(false); setNewBuildName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>&#x2715;</button>
          </div>
        )}
        {activeBuildId && (
          <button onClick={handleDeleteBuild} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-base)' }}>
            {t('gradeBuilds.deleteBuild')}
          </button>
        )}
      </div>

      {/* Editable build grades */}
      {activeBuildId && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('grades.subject')}</th>
                <th style={thStyle}>{t('grades.grade')}</th>
              </tr>
            </thead>
            <tbody>
              {HKDSE_SUBJECT_CODES.map(code => {
                const translated = t(`subjects.${code}`);
                const label = translated !== `subjects.${code}` ? translated : code;
                return (
                  <tr key={code}>
                    <td style={tdStyle}>{label}</td>
                    <td style={tdStyle}>
                      <select value={buildGrades[code] || ''} onChange={(e) => handleBuildGradeChange(code, e.target.value)} style={{ padding: '2px 4px', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>
                        <option value="">{'\u2014'}</option>
                        {HKDSE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Live scores panel */}
          {liveScores.length > 0 && (
            <div style={{ marginTop: 'var(--space-3)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-3)' }}>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', margin: '0 0 var(--space-2) 0' }}>{t('gradeBuilds.liveScores')}</h4>
              {liveScores.map(s => (
                <div key={s.jupas_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: 'var(--space-1) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{s.programme_name}</span>
                  <span style={{ fontWeight: 'var(--font-weight-bold)', fontVariantNumeric: 'tabular-nums', color: s.match_score >= 0.7 ? 'var(--color-success)' : s.match_score >= 0.4 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                    {s.match_score != null ? `${Math.round(s.match_score * 100)}%` : '\u2014'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actual grades view */}
      {!activeBuildId && (<>
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

      {/* Sitting toggle */}
      {availableSittings.length > 1 && (
        <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: 'var(--border-width) solid var(--color-border)', width: 'fit-content' }}>
          {availableSittings.map((sitting) => (
            <button
              key={sitting}
              onClick={() => setSittingFilter(sitting)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: activeSitting === sitting ? 'var(--color-primary)' : 'var(--color-surface)',
                color: activeSitting === sitting ? '#fff' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-base)',
                fontWeight: activeSitting === sitting ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                borderRight: 'var(--border-width) solid var(--color-border)',
              }}
            >
              {t(`common.${sitting.toLowerCase()}`) || sitting} ({sittingCounts[sitting]})
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>{t('grades.subject')}</th>
              <th style={thStyle}>{t('grades.year')}</th>
              <th style={thStyle}>{t('grades.grade')}</th>
              <th style={thStyle}>{t('grades.predictedGrade')}</th>
              <th style={thStyle}>{t('grades.transcript')}</th>
              <th style={thStyle}>{t('grades.notes')}</th>
              <th style={thStyle}>{t('grades.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredGrades.map((g) => (
              <tr key={g.id}>
                <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'var(--color-surface)' }}>{(() => { const k = `subjects.${g.subject_code}`; const tr = t(k); return tr !== k ? tr : (g.subject_name || g.subject_code); })()}</td>
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
                {(subjects && subjects.length > 0
                  ? subjects.map((s) => {
                      const translated = t(`subjects.${s.code}`);
                      return { code: s.code, name: translated !== `subjects.${s.code}` ? translated : (s.name || s.code) };
                    })
                  : HKDSE_SUBJECT_CODES.map((code) => {
                      const translated = t(`subjects.${code}`);
                      return { code, name: translated !== `subjects.${code}` ? translated : code };
                    })
                ).map((s) => (
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
      </>)}
    </div>
  );
}
