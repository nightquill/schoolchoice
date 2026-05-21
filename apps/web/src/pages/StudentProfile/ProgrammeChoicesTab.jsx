// Programme Choices tab — inline version of TargetSchools
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { EligibilityBadge } from '@schoolchoice/ui';
import { StatusChip } from '@schoolchoice/ui';
import ShapSummary from '../../components/ShapSummary/ShapSummary';
import { Modal } from '@schoolchoice/ui';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { toast } from 'sonner';
import { getTargets, addTarget, updateTarget, deleteTarget, reorderTargets } from '../../api/targets';
import { getAllProgrammes } from '../../api/jupas';
import { getSfProgrammes } from '../../api/selfFinancing';
import { getAutoRecommendations } from '../../api/match';
import { getGrades } from '../../api/grades';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useFeatureAccess } from '../../hooks/usePermission';
import { getRequirementBadges } from '../../utils/requirementBadges';
import { useLocalizedName } from '../../utils/localizedName';
// SubmissionHistory moved to separate /submissions page

/* ── Client-side best-5 + admission probability ── */
// JUPAS 2025 enhanced scale — same as backend grade_scales.json
const ENHANCED_SCALE = { '5**': 8.5, '5*': 7, '5': 5.5, '4': 4, '3': 3, '2': 2, '1': 1, 'U': 0 };
const CSD_SCALE = { 'AD': 2, 'A': 1, 'U': 0 };

function computeBest5FromV2Grades(grades) {
  // grades: array from /api/v1/students/:id/grades — [{subject_code, sitting, raw_grade}]
  if (!Array.isArray(grades) || grades.length === 0) return null;
  // Use MOCK sitting grades only
  const mockGrades = grades.filter(g => g.sitting === 'MOCK' && g.raw_grade);
  if (mockGrades.length < 5) return null;
  // Convert to enhanced scale points
  const scored = mockGrades.map(g => {
    const code = g.subject_code;
    const grade = String(g.raw_grade).trim();
    if (code === 'CSD') return { code, pts: CSD_SCALE[grade] ?? 0 };
    return { code, pts: ENHANCED_SCALE[grade] ?? 0 };
  });
  // Best 5: sort by points descending, take top 5
  scored.sort((a, b) => b.pts - a.pts);
  return scored.slice(0, 5).reduce((s, v) => s + v.pts, 0);
}

function estimateAdmissionProb(best5, admissionStats) {
  if (best5 == null || !admissionStats) return null;
  // Get most recent year's stats
  const years = Object.keys(admissionStats).filter(k => admissionStats[k]?.median != null);
  if (years.length === 0) return null;
  const latest = years.sort().pop();
  const stats = admissionStats[latest];
  const median = Number(stats.median);
  const lq = stats.lower_quartile != null ? Number(stats.lower_quartile) : null;
  const uq = stats.upper_quartile != null ? Number(stats.upper_quartile) : median + (median - (lq ?? median));
  if (lq == null) return null;
  // Piecewise linear interpolation (matches backend jupas_scorer logic)
  if (uq <= lq) return best5 >= median ? 0.75 : 0.25;
  if (best5 >= lq && best5 <= median) {
    return median === lq ? 0.375 : 0.25 + ((best5 - lq) / (median - lq)) * 0.25;
  } else if (best5 > median && best5 <= uq) {
    return uq === median ? 0.625 : 0.50 + ((best5 - median) / (uq - median)) * 0.25;
  } else if (best5 > uq) {
    const half = uq - median;
    if (half <= 0) return 0.85;
    const excess = (best5 - uq) / half;
    return 0.75 + 0.24 * (1 - Math.exp(-excess));
  } else {
    // below LQ
    const half = median - lq;
    if (half <= 0) return 0.15;
    const deficit = (lq - best5) / half;
    return 0.25 * Math.exp(-deficit);
  }
}

function probColor(prob) {
  if (prob == null) return { bg: '#f1f5f9', fg: '#64748b' }; // gray
  if (prob >= 0.70) return { bg: '#dcfce7', fg: '#166534' }; // green
  if (prob >= 0.40) return { bg: '#fef3c7', fg: '#92400e' }; // amber
  return { bg: '#fee2e2', fg: '#991b1b' }; // red
}

/* ── Admission band helpers ── */
function getBand(score) {
  if (score == null) return null;
  const pct = score * 100;
  if (pct >= 80) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 40) return 'C';
  if (pct >= 20) return 'D';
  return 'E';
}

const BAND_COLORS = {
  A: { bg: '#dcfce7', fg: '#166534' },
  B: { bg: '#dbeafe', fg: '#1e40af' },
  C: { bg: '#fef9c3', fg: '#854d0e' },
  D: { bg: '#ffedd5', fg: '#9a3412' },
  E: { bg: '#fee2e2', fg: '#991b1b' },
};

export default function ProgrammeChoicesTab({ studentId, isStudent = false }) {
  const { t } = useTranslation();
  const { canEdit: canEditTeacher } = useFeatureAccess('programme_choices');
  // Students always have edit access to their own choices
  const canEditChoices = isStudent || canEditTeacher;
  const ln = useLocalizedName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addingToSlot, setAddingToSlot] = useState(null); // which 志願 slot (1-20)
  const [selectedProgramme, setSelectedProgramme] = useState(null);
  const [addingTarget, setAddingTarget] = useState(false);
  const [autoRecs, setAutoRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [programmeMode, setProgrammeMode] = useState('jupas'); // 'jupas' | 'sf'
  // Filter chips + freeform search
  const [filters, setFilters] = useState([]); // [{type:'uni'|'text', value:'...'}]
  const [searchInput, setSearchInput] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(null); // null | 'uni' | 'faculty'
  const [filterSearch, setFilterSearch] = useState('');
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editMajors, setEditMajors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editConfidence, setEditConfidence] = useState(3);
  const [editSaving, setEditSaving] = useState(false);
  const prevTargetsRef = useRef([]);

  // Fetch student grades for admission probability (reuses react-query cache from GradesTab)
  const gradesQuery = useQuery({
    queryKey: ['grades', studentId],
    queryFn: () => getGrades(studentId),
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const studentBest5 = computeBest5FromV2Grades(gradesQuery.data?.grades ?? gradesQuery.data);

  const targetsQuery = useQuery({
    queryKey: ['targets', studentId],
    queryFn: () => getTargets(studentId),
  });

  const rawTargets = targetsQuery.data;
  const targets = (() => {
    const list = Array.isArray(rawTargets) ? rawTargets : (rawTargets?.targets ?? []);
    return [...list].sort((a, b) => (a.student_rank ?? 0) - (b.student_rank ?? 0));
  })();

  const setTargetsOptimistic = (newTargets) => {
    const list = Array.isArray(rawTargets) ? newTargets : { ...(rawTargets ?? {}), targets: newTargets };
    queryClient.setQueryData(['targets', studentId], list);
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newList = [...targets];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    prevTargetsRef.current = targets;
    setTargetsOptimistic(newList);
    try {
      await reorderTargets(studentId, newList.map((t) => t.id));
      toast.success(t('targets.reorderSuccess'));
    } catch {
      setTargetsOptimistic(prevTargetsRef.current);
      toast.error(t('targets.reorderFailed'));
    }
  };

  const handleMoveDown = async (index) => {
    if (index === targets.length - 1) return;
    const newList = [...targets];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    prevTargetsRef.current = targets;
    setTargetsOptimistic(newList);
    try {
      await reorderTargets(studentId, newList.map((t) => t.id));
      toast.success(t('targets.reorderSuccess'));
    } catch {
      setTargetsOptimistic(prevTargetsRef.current);
      toast.error(t('targets.reorderFailed'));
    }
  };

  const handleRemove = async (target) => {
    try {
      await deleteTarget(studentId, target.id);
      queryClient.invalidateQueries({ queryKey: ['targets', studentId] });
      toast.success(t('targets.removeSuccess'));
    } catch {
      toast.error(t('targets.removeFailed'));
    }
  };

  // Load all programmes (cached by react-query) — used for add modal + requirement badge lookup
  const allProgsQuery = useQuery({
    queryKey: ['jupas-all'],
    queryFn: getAllProgrammes,
    staleTime: 10 * 60 * 1000,
  });
  const allJupasProgs = allProgsQuery.data?.programmes ?? [];
  const allJupasSchools = allProgsQuery.data?.schools ?? [];
  // Lookup map for non-grade requirements by jupas_code
  const progReqsMap = {};
  allJupasProgs.forEach(p => { if (p.non_grade_requirements) progReqsMap[p.jupas_code] = p.non_grade_requirements; });

  // Self-financing programmes
  const sfProgsQuery = useQuery({
    queryKey: ['sf-programmes-all'],
    queryFn: () => getSfProgrammes(),
    staleTime: 10 * 60 * 1000,
  });
  const rawSfProgs = sfProgsQuery.data ?? [];
  const allSfProgs = (Array.isArray(rawSfProgs) ? rawSfProgs : rawSfProgs.programmes ?? []).map(p => ({
    jupas_code: p.programme_code || p.id,
    name: p.name,
    name_zh: p.name_zh,
    school_id: p.id,
    school_name: p.institution_name,
    school_name_zh: p.institution_name_zh,
    faculty: p.faculty,
    level: p.level,
    admission_stats: p.admission_score_mean ? { mean: p.admission_score_mean, lq: p.admission_score_lq, uq: p.admission_score_uq } : null,
    _sf: true,
  }));
  const allSfSchools = [...new Set(allSfProgs.map(p => p.school_name).filter(Boolean))].sort();

  // Active programme list based on toggle
  const allProgs = programmeMode === 'jupas' ? allJupasProgs : allSfProgs;
  const allSchools = programmeMode === 'jupas' ? allJupasSchools : allSfSchools;

  // Client-side filtering: each chip narrows results (AND logic)
  const filteredProgs = allProgs.filter((p) => {
    const searchable = `${p.jupas_code || ''} ${p.name} ${p.name_zh || ''} ${p.school_name} ${p.school_name_zh || ''} ${p.faculty}`.toLowerCase();
    for (const f of filters) {
      if (f.type === 'uni' && p.school_name !== f.value) return false;
      if (f.type === 'text' && !searchable.includes(f.value.toLowerCase())) return false;
    }
    if (searchInput.trim()) {
      if (!searchable.includes(searchInput.trim().toLowerCase())) return false;
    }
    return true;
  });

  const addFilter = (type, value) => {
    if (!filters.some(f => f.type === type && f.value === value)) {
      setFilters([...filters, { type, value }]);
    }
    setSearchInput('');
  };

  const removeFilter = (idx) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      // If matches a uni suggestion, add as uni filter
      const match = suggestions.find(s => s.type === 'uni');
      if (match) {
        addFilter('uni', match.value);
      } else {
        // Add as text filter
        addFilter('text', searchInput.trim());
      }
    }
  };

  // Auto-load recommendations when modal opens
  useEffect(() => {
    if (addModalOpen) {
      setRecsLoading(true);
      getAutoRecommendations(studentId, 5)
        .then((data) => {
          const recs = Array.isArray(data) ? data : (data.recommendations ?? []);
          const targetSchoolIds = new Set(targets.map(t => t.school_id));
          setAutoRecs(recs.filter(r => !targetSchoolIds.has(r.school_id ?? r.id)));
        })
        .catch(() => setAutoRecs([]))
        .finally(() => setRecsLoading(false));
    }
  }, [addModalOpen, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenEdit = (target) => {
    setEditTarget(target);
    setEditMajors(target.intended_majors?.join(', ') ?? '');
    setEditYear(target.year_of_entry ? String(target.year_of_entry) : '');
    setEditStatus(target.status ?? '');
    setEditConfidence(target.preference_confidence ?? 3);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const majorsList = editMajors.trim()
        ? editMajors.split(',').map((m) => m.trim()).filter(Boolean)
        : null;
      await updateTarget(studentId, editTarget.id, {
        intended_majors: majorsList,
        year_of_entry: editYear ? parseInt(editYear, 10) : null,
        status: editStatus || null,
        preference_confidence: editConfidence,
      });
      queryClient.invalidateQueries({ queryKey: ['targets', studentId] });
      setEditTarget(null);
      toast.success(t('targets.updateSuccess'));
    } catch {
      toast.error(t('targets.updateFailed'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddTarget = async () => {
    if (!selectedProgramme) return;
    setAddingTarget(true);
    try {
      await addTarget(studentId, {
        school_id: selectedProgramme.school_id ?? selectedProgramme.id,
        jupas_code: selectedProgramme.jupas_code || undefined,
        programme_name: selectedProgramme.programme_name || selectedProgramme.name || undefined,
        student_rank: addingToSlot || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['targets', studentId] });
      resetAddModal();
      toast.success(t('targets.addSuccess'));
    } catch {
      toast.error(t('targets.addFailed'));
    } finally {
      setAddingTarget(false);
    }
  };

  const resetAddModal = () => {
    setAddModalOpen(false);
    setAddingToSlot(null);
    setSelectedProgramme(null);
    setFilters([]);
    setSearchInput('');
    setFilterMenuOpen(null);
    setFilterSearch('');
    setAutoRecs([]);
    setProgrammeMode('jupas');
  };

  if (targetsQuery.isLoading) return <LoadingSpinner label={t('targets.loading')} />;

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 'var(--space-3)',
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    flexWrap: 'wrap',
  };

  const iconBtnStyle = {
    background: 'none',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--space-1) var(--space-2)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-base)',
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
          {t('profile.programmesTab.title')}
        </h3>
      </div>

      {/* JUPAS 選科表 — 25 choices grouped into bands A-E */}
      {(() => {
        const BANDS = [
          { id: 'A', slots: [1, 2, 3], bg: '#fff1f2', border: '#fecdd3', fg: '#be123c', tip: t('bands.A') },
          { id: 'B', slots: [4, 5, 6], bg: '#fef9c3', border: '#fde68a', fg: '#a16207', tip: t('bands.B') },
          { id: 'C', slots: [7, 8, 9, 10], bg: '#d1fae5', border: '#a7f3d0', fg: '#047857', tip: t('bands.C') },
          { id: 'D', slots: [11, 12, 13, 14], bg: '#dbeafe', border: '#bfdbfe', fg: '#1d4ed8', tip: t('bands.D') },
          { id: 'E', slots: [15, 16, 17, 18, 19, 20], bg: '#f1f5f9', border: '#e2e8f0', fg: '#475569', tip: t('bands.E') },
        ];
        // Map targets to slots by rank (1-indexed)
        const slotMap = {};
        targets.forEach((tgt) => { if (tgt.student_rank) slotMap[tgt.student_rank] = tgt; });
        // Also fill unranked targets into first available slots
        let nextSlot = 1;
        targets.forEach((tgt) => {
          if (!tgt.student_rank) {
            while (slotMap[nextSlot]) nextSlot++;
            if (nextSlot <= 20) { slotMap[nextSlot] = tgt; nextSlot++; }
          }
        });

        const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' };
        const tdBase = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', verticalAlign: 'middle' };

        return (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '44px', minWidth: '44px' }}>{t('programmes.rank')}</th>
                  <th style={{ ...thStyle, width: '36px', minWidth: '36px' }}>{t('programmeDetail.band')}</th>
                  <th style={{ ...thStyle, width: '80px', minWidth: '80px' }}>{t('programmes.code')}</th>
                  <th style={{ ...thStyle, minWidth: '280px' }}>{t('programmes.name')}</th>
                  <th style={{ ...thStyle, width: '70px', minWidth: '70px' }}>{t('programmes.score')}</th>
                  <th style={{ ...thStyle, width: '90px', minWidth: '90px' }}>{t('targets.applicationStatus')}</th>
                  <th style={{ ...thStyle, width: '56px', minWidth: '56px' }}></th>
                </tr>
              </thead>
              <tbody>
                {BANDS.map((band) =>
                  band.slots.map((slot, si) => {
                    const tgt = slotMap[slot];
                    const isFirst = si === 0;
                    const matchScore = tgt?.match_score != null ? Math.round(tgt.match_score * 100) : null;
                    return (
                      <tr key={slot} style={{ background: tgt ? 'var(--color-surface)' : band.bg + '40' }}>
                        {/* 志願 number */}
                        <td style={{ ...tdBase, textAlign: 'center', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>{slot}</td>
                        {/* Band label — only on first row of each band */}
                        {isFirst ? (
                          <td rowSpan={band.slots.length} style={{ ...tdBase, textAlign: 'center', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-lg)', color: band.fg, background: band.bg, borderRight: `3px solid ${band.border}`, verticalAlign: 'middle', lineHeight: 1 }}>
                            {band.id}
                          </td>
                        ) : null}
                        {/* JUPAS code */}
                        <td style={tdBase}>
                          {tgt?.jupas_code && (
                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                              {tgt.jupas_code}
                            </span>
                          )}
                        </td>
                        {/* Programme name + school */}
                        <td style={{ ...tdBase, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          {tgt ? (
                            <div>
                              <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                                {tgt.school_name ? `${ln(tgt, 'school_name')} — ` : ''}{ln(tgt, 'programme_name')}
                              </div>
                              {tgt.at_risk && <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '1px 5px', borderRadius: '6px', marginTop: '2px', display: 'inline-block' }}>{t('programmeDetail.atRisk')}</span>}
                              {!tgt.eligibility_pass && tgt.eligibility_pass !== null && (
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#991b1b', marginLeft: '4px' }}>{t('programmeDetail.ineligible').toUpperCase()}</span>
                              )}
                              {tgt.jupas_code && getRequirementBadges(progReqsMap[tgt.jupas_code], true).map((badge) => (
                                <span key={badge.label} style={{ fontSize: '10px', fontWeight: 600, color: badge.color, background: badge.bg, padding: '1px 5px', borderRadius: '6px', marginLeft: '4px', display: 'inline-block' }}>{badge.label}</span>
                              ))}
                            </div>
                          ) : canEditChoices ? (
                              <span
                                onClick={() => { setAddingToSlot(slot); setAddModalOpen(true); }}
                                style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', cursor: 'pointer', textDecoration: 'underline', fontStyle: 'italic' }}
                              >{t('programmes.addSlot')}</span>
                          ) : null}
                        </td>
                        {/* Admission score / probability */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          {matchScore != null && (
                            <span style={{ fontWeight: 'var(--font-weight-bold)', color: matchScore >= 70 ? '#059669' : matchScore >= 40 ? '#d97706' : '#dc2626' }}>
                              {matchScore}%
                            </span>
                          )}
                        </td>
                        {/* Status */}
                        <td style={tdBase}>
                          {tgt?.status && <StatusChip status={tgt.status} />}
                        </td>
                        {/* Actions */}
                        <td style={tdBase}>
                          {tgt && canEditChoices && (
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <button style={iconBtnStyle} onClick={() => handleOpenEdit(tgt)} aria-label="Edit" title="Edit">✎</button>
                              <button style={{ ...iconBtnStyle, color: 'var(--color-error)' }} onClick={() => setConfirmRemoveTarget(tgt)} aria-label="Remove" title="Remove">×</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Add programme — full-width custom dialog */}
      {addModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) resetAddModal(); }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: 'var(--border-width) solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                {t('profile.programmesTab.addProgramme')}{addingToSlot ? ` — ${t('programmes.rank')} ${addingToSlot}` : ''}
              </h2>
              <button onClick={resetAddModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} aria-label="Close">×</button>
            </div>

            {/* Two-pane body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {/* Left pane: Recommendations */}
              <div style={{ flex: '1 1 340px', borderRight: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)', overflowY: 'auto' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>
                  {t('targets.recommended')}
                </div>
                {recsLoading ? (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('targets.loadingRecs')}</div>
                ) : autoRecs.length === 0 ? (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('profile.programmesTab.noResults')}</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {autoRecs.map((rec) => {
                      const recId = rec.school_id ?? rec.id;
                      const isSelected = selectedProgramme?.school_id === recId && selectedProgramme?.jupas_code === (rec.major_jupas_code || null);
                      return (
                        <li key={`${recId}-${rec.major_jupas_code ?? rec.major_name ?? ''}`} onClick={() => {
                          setSelectedProgramme({ school_id: recId, jupas_code: rec.major_jupas_code || null, programme_name: rec.major_name || null, name: rec.major_name || rec.school_name || rec.name });
                        }} style={{
                          padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                          background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                          borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)',
                          border: isSelected ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                          marginBottom: 'var(--space-1)',
                        }}>
                          <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{ln(rec, 'school_name') !== '—' ? ln(rec, 'school_name') : ln(rec, 'name')}</div>
                          {rec.major_name && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginTop: '2px' }}>
                              {rec.major_name}{rec.major_jupas_code ? ` (${rec.major_jupas_code})` : ''}
                            </div>
                          )}
                          {rec.final_score != null && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: rec.final_score >= 0.7 ? 'var(--color-success)' : rec.final_score >= 0.4 ? 'var(--color-warning)' : 'var(--color-error)', fontWeight: 'var(--font-weight-medium)', marginTop: '2px' }}>
                              {Math.round(rec.final_score * 100)}{t('programmeDetail.pctMatch')}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Right pane: Chip-based filter + search */}
              <div style={{ flex: '1 1 460px', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* JUPAS / Self-Financing toggle */}
                <div style={{ display: 'flex', gap: '2px', marginBottom: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
                  <button
                    onClick={() => { setProgrammeMode('jupas'); setFilters([]); setSearchInput(''); }}
                    style={{
                      flex: 1, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family-base)',
                      border: 'none', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                      background: programmeMode === 'jupas' ? 'var(--color-surface)' : 'transparent',
                      color: programmeMode === 'jupas' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      boxShadow: programmeMode === 'jupas' ? 'var(--shadow-sm)' : 'none',
                    }}
                    aria-pressed={programmeMode === 'jupas'}
                  >
                    {t('programmeDetail.jupasToggle')} ({allJupasProgs.length})
                  </button>
                  <button
                    onClick={() => { setProgrammeMode('sf'); setFilters([]); setSearchInput(''); }}
                    style={{
                      flex: 1, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family-base)',
                      border: 'none', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                      background: programmeMode === 'sf' ? 'var(--color-surface)' : 'transparent',
                      color: programmeMode === 'sf' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      boxShadow: programmeMode === 'sf' ? 'var(--shadow-sm)' : 'none',
                    }}
                    aria-pressed={programmeMode === 'sf'}
                  >
                    {t('programmeDetail.sfToggle')} ({allSfProgs.length})
                  </button>
                </div>

                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                  {t('programmes.searchLabel')}
                </div>

                {/* Filter bar: chips + "Add filter" button */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: 'var(--space-2)', minHeight: '32px' }}>
                  {filters.map((f, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: '14px',
                      background: f.type === 'uni' ? '#dbeafe' : '#f1f5f9',
                      color: f.type === 'uni' ? '#1d4ed8' : '#374151',
                      fontWeight: 500, border: '1px solid transparent',
                    }}>
                      {f.type === 'uni' ? t('programmes.filterUniversity') : t('programmes.filterSearch')}: {f.value.length > 25 ? f.value.slice(0, 25) + '…' : f.value}
                      <button onClick={() => removeFilter(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
                        fontSize: '13px', lineHeight: 1, padding: 0, marginLeft: '2px', opacity: 0.6,
                      }} aria-label="Remove filter">×</button>
                    </span>
                  ))}

                  {/* "+ Add filter" button with category menu */}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setFilterMenuOpen(filterMenuOpen ? null : 'categories')} style={{
                      fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: '14px',
                      background: 'var(--color-surface)', color: 'var(--color-primary)',
                      border: '1px dashed var(--color-primary)', cursor: 'pointer',
                      fontFamily: 'var(--font-family-base)', fontWeight: 500,
                    }}>
                      {t('programmeDetail.addFilter')}
                    </button>

                    {/* Category picker */}
                    {filterMenuOpen === 'categories' && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: '4px',
                        background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
                        borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-md)',
                        minWidth: '160px', overflow: 'hidden',
                      }}>
                        <div onClick={() => { setFilterMenuOpen('uni'); setFilterSearch(''); }} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--font-size-sm)', borderBottom: '1px solid var(--color-border)' }}>
                          <div style={{ fontWeight: 600 }}>{t('programmes.filterUniversity')}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('programmes.filterByInstitution')}</div>
                        </div>
                        <div onClick={() => { setFilterMenuOpen('progtype'); setFilterSearch(''); }} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                          <div style={{ fontWeight: 600 }}>{t('programmes.filterProgramme')}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('programmes.filterByProgramme')}</div>
                        </div>
                      </div>
                    )}

                    {/* University picker */}
                    {filterMenuOpen === 'uni' && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: '4px',
                        background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
                        borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-md)',
                        minWidth: '280px', maxHeight: '300px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      }}>
                        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
                          <input autoFocus value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder={t('programmes.searchUniversities')}
                            style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                          {allSchools
                            .filter(s => !filters.some(f => f.type === 'uni' && f.value === s))
                            .filter(s => !filterSearch || s.toLowerCase().includes(filterSearch.toLowerCase()))
                            .map(s => (
                              <div key={s} onClick={() => { addFilter('uni', s); setFilterMenuOpen(null); }} style={{
                                padding: '6px 14px', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                                borderBottom: '1px solid var(--color-border)',
                              }}>{s}</div>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Programme type picker — text search adds as filter chip */}
                    {filterMenuOpen === 'progtype' && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: '4px',
                        background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
                        borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-md)',
                        minWidth: '280px', overflow: 'hidden',
                      }}>
                        <div style={{ padding: '6px 8px' }}>
                          <input
                            autoFocus
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && filterSearch.trim()) {
                                addFilter('text', filterSearch.trim());
                                setFilterMenuOpen(null);
                              }
                            }}
                            placeholder={t('programmes.filterByProgrammeHint')}
                            style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)', boxSizing: 'border-box' }}
                          />
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: '4px 0 2px' }}>
                            {t('programmes.pressEnterToFilter')}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {filters.length > 0 && (
                    <button onClick={() => setFilters([])} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-family-base)', padding: '2px 4px',
                    }}>{t('programmes.clearFilters')}</button>
                  )}
                </div>

                {/* Search input */}
                <input
                  autoFocus={!filterMenuOpen}
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('programmes.searchPlaceholder')}
                  style={{ ...inputStyle, marginBottom: 'var(--space-2)', width: '100%' }}
                />

                {/* Result count */}
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {(programmeMode === 'jupas' ? allProgsQuery.isLoading : sfProgsQuery.isLoading) ? t('programmes.loadingProgrammes') :
                    filteredProgs.length === 0 ? t('profile.programmesTab.noResults') :
                    t('schools.showing', { count: filteredProgs.length, total: allProgs.length })}
                </div>

                {/* Results list */}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {filteredProgs.map((prog) => {
                    const progKey = prog.jupas_code || prog.id;
                    const isSelected = selectedProgramme?.jupas_code === progKey;
                    const admProb = estimateAdmissionProb(studentBest5, prog.admission_stats);
                    const admCol = probColor(admProb);
                    return (
                      <li key={progKey} onClick={() => {
                        setSelectedProgramme({
                          school_id: prog.school_id,
                          jupas_code: prog._sf ? null : prog.jupas_code,
                          programme_name: prog.name,
                          name: prog.name,
                          _sf: !!prog._sf,
                        });
                      }} style={{
                        padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                        background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                        borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)',
                        border: isSelected ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                        marginBottom: 'var(--space-1)',
                      }} role="option" aria-selected={isSelected}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                          {prog.jupas_code && !prog._sf && (
                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
                              {prog.jupas_code}
                            </span>
                          )}
                          {prog._sf && prog.level && (
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, background: '#f5f3ff', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
                              {prog.level.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', flex: 1 }}>{ln(prog, 'school_name')}</span>
                          {admProb != null && (
                            <span style={{ fontSize: '10px', fontWeight: 600, background: admCol.bg, color: admCol.fg, padding: '1px 5px', borderRadius: '4px', flexShrink: 0, lineHeight: '16px' }}>
                              {Math.round(admProb * 100)}%
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 'var(--font-weight-medium)', marginTop: '2px' }}>{ln(prog, 'name')}</div>
                        {prog.faculty && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{prog.faculty}</div>}
                        {prog.website_url && (
                          <a href={prog.website_url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'none', marginTop: '2px', display: 'inline-block' }}>
                            {t('programmeDetail.jupasLink')}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: 'var(--border-width) solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                {selectedProgramme ? (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', margin: 0 }}>
                    {t('targets.selected')} <strong>{selectedProgramme.jupas_code ? `${selectedProgramme.jupas_code} — ` : ''}{selectedProgramme.name || selectedProgramme.programme_name}</strong>
                  </p>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>{t('programmes.selectInstruction')}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={resetAddModal}>{t('dashboard.cancel')}</Button>
                <Button onClick={handleAddTarget} disabled={!selectedProgramme || addingTarget}>
                  {addingTarget ? t('targets.adding') : t('profile.programmesTab.addProgramme')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove programme confirmation */}
      <Modal
        isOpen={!!confirmRemoveTarget}
        title={t('targets.remove')}
        onClose={() => setConfirmRemoveTarget(null)}
        onConfirm={() => {
          if (confirmRemoveTarget) handleRemove(confirmRemoveTarget);
          setConfirmRemoveTarget(null);
        }}
        confirmLabel={t('confirmation.confirm')}
        confirmVariant="danger"
        cancelLabel={t('confirmation.cancel')}
      >
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          {t('confirmation.removeProgramme', {
            programme: confirmRemoveTarget?.programme_name || confirmRemoveTarget?.school_name || '',
            band: getBand(confirmRemoveTarget?.match_score) || '—',
          })}
        </p>
      </Modal>

      {/* Edit target modal */}
      <Modal
        isOpen={!!editTarget}
        title={`${t('targets.editTitle')} ${editTarget?.school_name ?? ''}`}
        onClose={() => setEditTarget(null)}
        onConfirm={handleEditSave}
        confirmLabel={editSaving ? t('profile.saving') : t('targets.save')}
        confirmVariant="primary"
      >
        <div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
              {t('targets.intendedMajors')} <span style={{ color: 'var(--color-text-secondary)' }}>{t('targets.commaSeparated')}</span>
            </label>
            <input value={editMajors} onChange={(e) => setEditMajors(e.target.value)} placeholder={t('targets.majorsPlaceholder')} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('targets.yearOfEntry')}</label>
            <input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('targets.applicationStatus')}</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
              <option value="">{t('targets.notSet')}</option>
              <option value="CONSIDERING">{t('targets.considering')}</option>
              <option value="APPLIED">{t('targets.applied')}</option>
              <option value="ADMITTED">{t('targets.admitted')}</option>
              <option value="REJECTED">{t('targets.rejected')}</option>
              <option value="WITHDRAWN">{t('targets.withdrawn')}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
              {t('targets.studentConfidence')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input type="range" min="1" max="5" value={editConfidence} onChange={(e) => setEditConfidence(parseInt(e.target.value, 10))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} aria-label="Student confidence level" />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', minWidth: '90px', textAlign: 'right' }}>
                {editConfidence === 5 ? t('targets.decided') : editConfidence === 4 ? t('targets.strong') : editConfidence === 3 ? t('targets.interested') : editConfidence === 2 ? t('targets.exploring') : t('targets.unsure')}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
