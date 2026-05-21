// Student Dashboard — flat tabs: Choices | Actual Grades | [grade sets] | + Add
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import { toast } from 'sonner';
import ProgrammeChoicesTab from '../StudentProfile/ProgrammeChoicesTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useGradesTab } from '../../hooks/useGradesTab';
import client from '@schoolchoice/ui/api/client';

const HKDSE_SUBJECT_CODES = [
  'CHLA', 'ENGL', 'MATH', 'CSD', 'CHIH', 'CHIL', 'HIST', 'GEOG', 'TOUR',
  'VART', 'MUSC', 'ERS', 'PE', 'ECON', 'BAFS', 'BIOL', 'CHEM', 'PHYS',
  'CSCI', 'ISCI', 'M1', 'M2', 'ICT', 'DAT', 'HMSC', 'TL',
  'FREN', 'GERM', 'JAPA', 'SPAN', 'PTH', 'APL_GENERIC',
];
const HKDSE_GRADES = ['5**', '5*', '5', '4', '3', '2', '1', 'U'];

/* ── Actual Grades view (read-only for students) ── */
function ActualGradesView({ studentId, t }) {
  const { grades, loading } = useGradesTab(studentId);
  const [sitting, setSitting] = useState(null);

  const sittingCounts = {};
  (grades || []).forEach(g => { sittingCounts[g.sitting] = (sittingCounts[g.sitting] || 0) + 1; });
  const sittings = Object.keys(sittingCounts).sort();
  const activeSitting = sitting ?? (sittings.length > 0 ? sittings.reduce((a, b) => sittingCounts[a] >= sittingCounts[b] ? a : b) : 'MOCK');
  const filtered = (grades || []).filter(g => g.sitting === activeSitting);

  const subjectLabel = (code) => {
    const key = `subjects.${code}`;
    const tr = t(key);
    return tr !== key ? tr : code;
  };

  if (loading) return <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{t('common.loading')}</p>;

  if (!filtered.length) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: 'var(--color-surface)' }}>{t('studentPortal.noGradesYet')}</div>;
  }

  return (
    <div>
      {sittings.length > 1 && (
        <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: 'var(--border-width) solid var(--color-border)', width: 'fit-content', marginBottom: 'var(--space-4)' }}>
          {sittings.map(s => (
            <button key={s} onClick={() => setSitting(s)} style={{
              padding: 'var(--space-2) var(--space-4)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)',
              background: activeSitting === s ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeSitting === s ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: activeSitting === s ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              borderRight: 'var(--border-width) solid var(--color-border)',
            }}>{s} ({sittingCounts[s]})</button>
          ))}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
        <thead>
          <tr>
            {[t('grades.subject'), t('grades.year'), t('grades.grade'), t('grades.predictedGrade')].map(h => (
              <th key={h} style={{ background: 'var(--color-background)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', textAlign: 'left', borderBottom: 'var(--border-width) solid var(--color-border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((g, i) => (
            <tr key={g.id || i}>
              <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', fontWeight: 'var(--font-weight-medium)' }}>{subjectLabel(g.subject_code) || g.subject_name}</td>
              <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{g.year_of_exam || '—'}</td>
              <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', fontWeight: 'var(--font-weight-bold)' }}>{g.raw_grade || '—'}</td>
              <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{g.predicted_grade || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Grade Set Editor (line-by-line) ── */
function GradeSetEditor({ build, studentId, t, onRefresh, onDelete }) {
  const [grades, setGrades] = useState(build.grades || {});
  const [saving, setSaving] = useState(false);
  const saveRef = useRef(null);

  const subjectLabel = (code) => {
    const key = `subjects.${code}`;
    const tr = t(key);
    return tr !== key ? tr : code;
  };

  const handleChange = (code, val) => {
    const updated = { ...grades, [code]: val };
    if (!val) delete updated[code];
    setGrades(updated);

    // Auto-save after 500ms
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        await client.put(`/api/v1/students/${studentId}/grade-builds/${build.id}`, { grades: updated });
      } catch { /* silent */ }
    }, 500);
  };

  const handleSave = async () => {
    if (saveRef.current) clearTimeout(saveRef.current);
    setSaving(true);
    try {
      await client.put(`/api/v1/students/${studentId}/grade-builds/${build.id}`, { grades });
      toast.success(t('studentPortal.gradesSaved'));
    } catch {
      toast.error(t('studentPortal.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('studentPortal.deleteBuildConfirm'))) return;
    try {
      await client.delete(`/api/v1/students/${studentId}/grade-builds/${build.id}`);
      toast.success(t('studentPortal.buildDeleted'));
      onDelete();
    } catch {
      toast.error(t('studentPortal.saveFailed'));
    }
  };

  const filled = Object.values(grades).filter(Boolean).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{filled} / {HKDSE_SUBJECT_CODES.length} subjects</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>{saving ? '...' : t('common.save')}</Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} style={{ color: 'var(--color-error)' }}>{t('gradeBuilds.deleteBuild')}</Button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={{ background: 'var(--color-background)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', textAlign: 'left', borderBottom: 'var(--border-width) solid var(--color-border)' }}>{t('grades.subject')}</th>
            <th style={{ background: 'var(--color-background)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', textAlign: 'left', borderBottom: 'var(--border-width) solid var(--color-border)' }}>{t('grades.grade')}</th>
          </tr>
        </thead>
        <tbody>
          {HKDSE_SUBJECT_CODES.map(code => (
            <tr key={code}>
              <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>{subjectLabel(code)}</td>
              <td style={{ padding: 'var(--space-2) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                <select value={grades[code] || ''} onChange={e => handleChange(code, e.target.value)}
                  style={{ padding: '2px 4px', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
                  <option value="">—</option>
                  {HKDSE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Dashboard ── */
function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('choices');
  const [scoringGradeSet, setScoringGradeSet] = useState(''); // '' = actual grades, buildId = use that build
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [creatingBuild, setCreatingBuild] = useState(false);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data;

  // Grade builds — use the regular endpoint scoped to student ID
  const studentId = account?.student_id;
  const buildsQuery = useQuery({
    queryKey: ['grade-builds', studentId],
    queryFn: () => client.get(`/api/v1/students/${studentId}/grade-builds`).then(r => r.data),
    enabled: !!studentId,
  });
  const builds = buildsQuery.data?.builds ?? [];

  useEffect(() => {
    if (account && account.role !== 'student') navigate('/dashboard', { replace: true });
  }, [account, navigate]);

  useEffect(() => {
    if (account?.student_id) {
      client.get('/api/v1/student/choices').then(r => {
        setSubmissionStatus(r.data?.submission?.status || null);
      }).catch(() => {});
    }
  }, [account?.student_id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const targetsResp = await client.get(`/api/v1/students/${account.student_id}/targets`);
      const targets = targetsResp.data?.targets ?? [];
      const choices = targets.filter(t => t.jupas_code).sort((a, b) => (a.student_rank ?? 99) - (b.student_rank ?? 99))
        .map((t, i) => ({ rank: t.student_rank || i + 1, jupas_code: t.jupas_code, programme_name: t.programme_name || '', school_name: t.school_name || '' }));
      if (choices.length === 0) { toast.error(t('studentDashboard.addProgrammeFirst')); return; }
      await client.put('/api/v1/student/choices', { choices });
      await client.post('/api/v1/student/choices/submit');
      setSubmissionStatus('pending');
      toast.success(t('studentDashboard.submitSuccess'));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : t('studentDashboard.submitFailed'));
    } finally { setSubmitting(false); }
  };

  const handleAddBuild = async () => {
    const name = prompt(t('studentPortal.buildNamePlaceholder'));
    if (!name?.trim()) return;
    if (builds.length >= 5) { toast.error(t('studentPortal.maxBuildsReached')); return; }
    setCreatingBuild(true);
    try {
      const r = await client.post(`/api/v1/students/${studentId}/grade-builds`, { name: name.trim(), grades: {} });
      await buildsQuery.refetch();
      setActiveTab(`build:${r.data.id}`);
      toast.success(t('studentPortal.buildCreated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed');
    } finally { setCreatingBuild(false); }
  };

  const handleDeleteBuild = (buildId) => {
    buildsQuery.refetch();
    setActiveTab('grades');
  };

  if (accountQuery.isLoading || !account) {
    return <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}><LoadingSpinner label={t('common.loading')} /></div>;
  }

  if (!studentId) {
    return <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}><NavBarV2 account={account} /><div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t('studentDashboard.noProfile')}</div></div>;
  }

  const statusLabels = {
    pending: { text: t('submissionHistory.pendingReview'), bg: '#fef3c7', color: '#92400e' },
    approved: { text: t('submissionHistory.approved'), bg: '#dcfce7', color: '#166534' },
    revision_requested: { text: t('submissionHistory.revisionRequested'), bg: '#fee2e2', color: '#991b1b' },
    rejected: { text: t('submissionHistory.rejected'), bg: '#fee2e2', color: '#991b1b' },
    draft: { text: t('submissionHistory.draft'), bg: '#f1f5f9', color: '#475569' },
  };
  const statusInfo = submissionStatus ? statusLabels[submissionStatus] : null;

  // Tab definitions: fixed tabs + dynamic grade set tabs + add button
  const tabStyle = (isActive) => ({
    padding: 'var(--space-3) var(--space-5)',
    fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)',
    fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  });

  const activeBuild = activeTab.startsWith('build:') ? builds.find(b => b.id === activeTab.slice(6)) : null;

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
            {account.display_name}
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-3)' }}>
              ID: {account.email?.replace('@student.local', '')}
            </span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {statusInfo && (
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600, background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.text}</span>
            )}
            <Button onClick={handleSubmit} disabled={submitting || submissionStatus === 'pending'}>
              {submitting ? t('studentDashboard.submitting') : submissionStatus === 'pending' ? t('studentDashboard.awaitingReview') : t('studentDashboard.submitToTeacher')}
            </Button>
          </div>
        </div>

        {/* Flat tab bar: Choices | My Grades | [grade sets...] | + Add */}
        <div style={{ display: 'flex', borderBottom: 'var(--border-width) solid var(--color-border)', marginBottom: 'var(--space-4)', gap: 0, overflowX: 'auto' }}>
          <button onClick={() => setActiveTab('choices')} style={tabStyle(activeTab === 'choices')}>
            {t('studentPortal.myChoices')}
          </button>
          <button onClick={() => setActiveTab('grades')} style={tabStyle(activeTab === 'grades')}>
            {t('studentPortal.myGrades')}
          </button>
          {builds.map(b => (
            <button key={b.id} onClick={() => setActiveTab(`build:${b.id}`)} style={tabStyle(activeTab === `build:${b.id}`)}>
              {b.name}
            </button>
          ))}
          {builds.length < 5 && (
            <button onClick={handleAddBuild} disabled={creatingBuild}
              style={{ ...tabStyle(false), color: 'var(--color-primary)', fontWeight: 'var(--font-weight-normal)' }}>
              {t('gradeBuilds.newBuild')}
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 'choices' && (
          <div>
            {/* Grade set selector for scoring */}
            {builds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('studentPortal.gradeSetLabel')}:</span>
                <select
                  value={scoringGradeSet}
                  onChange={e => setScoringGradeSet(e.target.value)}
                  style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}
                >
                  <option value="">{t('gradeBuilds.actualGrades')}</option>
                  {builds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <ProgrammeChoicesTab
              studentId={studentId}
              isStudent={true}
              gradeBuildId={scoringGradeSet || null}
            />
          </div>
        )}
        {activeTab === 'grades' && <ActualGradesView studentId={studentId} t={t} />}
        {activeBuild && <GradeSetEditor key={activeBuild.id} build={activeBuild} studentId={studentId} t={t} onRefresh={() => buildsQuery.refetch()} onDelete={() => handleDeleteBuild(activeBuild.id)} />}
      </div>
    </div>
  );
}

export default StudentDashboard;
