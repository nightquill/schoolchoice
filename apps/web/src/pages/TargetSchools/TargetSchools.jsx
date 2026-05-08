// REQ-092, REQ-093: Target Schools Page with reorder support
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { EligibilityBadge } from '@schoolchoice/ui';
import { StatusChip } from '@schoolchoice/ui';
import ShapSummary from '../../components/ShapSummary/ShapSummary';
import { Modal } from '@schoolchoice/ui';
import { Toast } from '@schoolchoice/ui';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { useToast } from '@schoolchoice/ui/hooks/useToast';
import { getTargets, addTarget, updateTarget, deleteTarget, reorderTargets } from '../../api/targets';
import { searchSchools } from '../../api/schoolsV2';
import { getStudent } from '../../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getAutoRecommendations } from '../../api/match';

// ---- TargetSchoolRow ----
function TargetSchoolRow({ target, rank, isFirst, isLast, onMoveUp, onMoveDown, onRemove, onEdit }) {
  const navigate = useNavigate();

  // match_score is stored as 0.0–1.0 in the DB; multiply by 100 for display
  const matchScore = target.match_score != null ? Math.round(target.match_score * 100) : null;
  const matchColor = matchScore != null && matchScore >= 70
    ? 'var(--color-success)'
    : matchScore != null && matchScore >= 40
    ? 'var(--color-warning)'
    : 'var(--color-error)';

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4) var(--space-3)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    background: target.eligibility_pass ? 'var(--color-surface)' : 'rgba(203,213,225,0.4)',
    flexWrap: 'wrap',
  };

  const rankBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--border-radius-sm)',
    background: 'var(--color-primary)',
    color: 'var(--color-surface)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-bold)',
    flexShrink: 0,
  };

  const schoolNameStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    display: 'block',
  };

  const matchStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: matchColor,
    flexShrink: 0,
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

  const removeBtnStyle = {
    ...iconBtnStyle,
    color: 'var(--color-error)',
    borderColor: 'var(--color-error)',
  };

  return (
    <li style={rowStyle}>
      <span style={rankBadgeStyle} aria-label={`Rank ${rank}`}>{rank}</span>
      <div style={{ flex: 1, minWidth: '120px' }}>
        <span style={schoolNameStyle}>
          {target.school_name}
          {target.preference_confidence != null && (
            <span style={{
              marginLeft: '8px',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '8px',
              fontWeight: 500,
              background: target.preference_confidence >= 4 ? '#dbeafe' : target.preference_confidence >= 3 ? '#f3f4f6' : '#fef3c7',
              color: target.preference_confidence >= 4 ? '#1d4ed8' : target.preference_confidence >= 3 ? '#6b7280' : '#92400e',
            }}>
              {target.preference_confidence === 5 ? 'Decided' : target.preference_confidence === 4 ? 'Strong' : target.preference_confidence === 3 ? 'Interested' : target.preference_confidence === 2 ? 'Exploring' : 'Unsure'}
            </span>
          )}
        </span>
        {target.intended_majors?.length > 0 && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginTop: '2px', fontWeight: 'var(--font-weight-medium)' }}>
            {target.intended_majors.join(' · ')}
          </div>
        )}
        {target.year_of_entry && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>Entry: {target.year_of_entry}</div>
        )}
      </div>
      <EligibilityBadge pass={target.eligibility_pass} failingCriteria={target.failing_criteria} />
      {target.at_risk && (
        <span style={{fontSize:'10px',fontWeight:700,color:'#fff',background:'#dc2626',padding:'1px 6px',borderRadius:'8px',flexShrink:0}}>AT RISK</span>
      )}
      {matchScore != null && (
        <span style={matchStyle} aria-label={`Match score: ${matchScore}%`}>
          {matchScore}%
        </span>
      )}
      <ShapSummary shapExplanation={target.shap_explanation} maxFeatures={1} />
      {target.status && <StatusChip status={target.status} />}
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
        <button
          style={iconBtnStyle}
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`Move ${target.school_name} up`}
        >
          <ChevronUp size={14} />
        </button>
        <button
          style={iconBtnStyle}
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`Move ${target.school_name} down`}
        >
          <ChevronDown size={14} />
        </button>
        <button
          style={iconBtnStyle}
          onClick={() => navigate(`/schools/${target.school_id}`)}
          aria-label={`View ${target.school_name} profile`}
        >
          View
        </button>
        <button
          style={iconBtnStyle}
          onClick={onEdit}
          aria-label={`Edit ${target.school_name} target details`}
        >
          Edit
        </button>
        <button
          style={removeBtnStyle}
          onClick={onRemove}
          aria-label={`Remove ${target.school_name} from target list`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

// ---- By-Major view ----
function MajorView({ targets }) {
  const navigate = useNavigate();

  // Build map: major -> [{target, matchScore, matchColor}]
  const majorMap = {};
  targets.forEach((target) => {
    const majors = target.intended_majors?.length > 0 ? target.intended_majors : ['__none__'];
    majors.forEach((major) => {
      if (!majorMap[major]) majorMap[major] = [];
      majorMap[major].push(target);
    });
  });

  const sortedMajors = Object.keys(majorMap).filter((m) => m !== '__none__').sort();
  const hasMajors = sortedMajors.length > 0;
  const noMajorTargets = majorMap['__none__'] || [];

  const schoolEntryStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    flexWrap: 'wrap',
  };

  const majorHeadingStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-primary)',
    background: 'rgba(37,99,235,0.06)',
    padding: 'var(--space-2) var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const renderTarget = (target) => {
    const matchScore = target.match_score != null ? Math.round(target.match_score * 100) : null;
    const matchColor = matchScore != null && matchScore >= 70 ? 'var(--color-success)' : matchScore != null && matchScore >= 40 ? 'var(--color-warning)' : 'var(--color-error)';
    return (
      <div key={target.id} style={schoolEntryStyle}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <span
            style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate(`/schools/${target.school_id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/schools/${target.school_id}`)}
          >
            {target.school_name}
          </span>
        </div>
        <EligibilityBadge pass={target.eligibility_pass} failingCriteria={target.failing_criteria} />
        {matchScore != null && (
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: matchColor, flexShrink: 0 }}>
            {matchScore}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', boxShadow: 'var(--shadow-sm)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' }}>
      {hasMajors && sortedMajors.map((major) => (
        <div key={major}>
          <div style={majorHeadingStyle}>{major}</div>
          {majorMap[major].map(renderTarget)}
        </div>
      ))}
      {noMajorTargets.length > 0 && (
        <div>
          <div style={{ ...majorHeadingStyle, color: 'var(--color-text-secondary)', background: 'var(--color-background)' }}>No Major Specified</div>
          {noMajorTargets.map(renderTarget)}
        </div>
      )}
      {!hasMajors && noMajorTargets.length === 0 && (
        <div style={{ padding: 'var(--space-5)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>No targets to display.</div>
      )}
    </div>
  );
}

// ---- Main TargetSchools ----
function TargetSchools() {
  const { id } = useParams();
  const { toasts, showToast, removeToast } = useToast();
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [targets, setTargets] = useState([]);
  const [viewMode, setViewMode] = useState('school'); // 'school' | 'major'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolResults, setSchoolResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [intendedMajors, setIntendedMajors] = useState('');
  const [yearOfEntry, setYearOfEntry] = useState('');
  const [addingTarget, setAddingTarget] = useState(false);
  const [autoRecs, setAutoRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editMajors, setEditMajors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editConfidence, setEditConfidence] = useState(3);
  const [editSaving, setEditSaving] = useState(false);
  const [newMajors, setNewMajors] = useState([]);
  const prevTargetsRef = useRef([]);

  useEffect(() => {
    Promise.all([
      getStudent(id),
      getTargets(id),
      getAccount(),
    ])
      .then(([studentData, targetsData, accountData]) => {
        setStudent(studentData);
        const list = Array.isArray(targetsData) ? targetsData : (targetsData.targets ?? []);
        const sorted = [...list].sort((a, b) => (a.student_rank ?? 0) - (b.student_rank ?? 0));
        setTargets(sorted);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to load target schools.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newList = [...targets];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    prevTargetsRef.current = targets;
    setTargets(newList);
    try {
      await reorderTargets(id, newList.map((t) => t.id));
      showToast('Preference order saved.', 'success');
    } catch {
      setTargets(prevTargetsRef.current);
      showToast('Failed to reorder targets.', 'error');
    }
  };

  const handleMoveDown = async (index) => {
    if (index === targets.length - 1) return;
    const newList = [...targets];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    prevTargetsRef.current = targets;
    setTargets(newList);
    try {
      await reorderTargets(id, newList.map((t) => t.id));
      showToast('Preference order saved.', 'success');
    } catch {
      setTargets(prevTargetsRef.current);
      showToast('Failed to reorder targets.', 'error');
    }
  };

  const handleRemove = async (target) => {
    try {
      await deleteTarget(id, target.id);
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
      showToast('School removed from target list.', 'success');
    } catch {
      showToast('Failed to remove school.', 'error');
    }
  };

  const handleSearchSchools = async (query = schoolSearch) => {
    setSearchLoading(true);
    try {
      const result = await searchSchools({ q: query, limit: 20 });
      setSchoolResults(Array.isArray(result) ? result : (result.items ?? []));
    } catch {
      showToast('School search failed.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  // Auto-load schools + recommendations when modal opens
  useEffect(() => {
    if (addModalOpen) {
      if (schoolResults.length === 0) handleSearchSchools('');
      setRecsLoading(true);
      getAutoRecommendations(id, 5)
        .then((data) => setAutoRecs(Array.isArray(data) ? data : (data.recommendations ?? [])))
        .catch(() => setAutoRecs([]))
        .finally(() => setRecsLoading(false));
    }
  }, [addModalOpen, id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const updated = await updateTarget(id, editTarget.id, {
        intended_majors: majorsList,
        year_of_entry: editYear ? parseInt(editYear, 10) : null,
        status: editStatus || null,
        preference_confidence: editConfidence,
      });
      setTargets((prev) => prev.map((t) => (t.id === editTarget.id ? { ...t, ...updated } : t)));
      setEditTarget(null);
      showToast('Target updated.', 'success');
    } catch {
      showToast('Failed to update target.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddTarget = async () => {
    if (!selectedSchool) return;
    setAddingTarget(true);
    try {
      const majorsList = intendedMajors.trim()
        ? intendedMajors.split(',').map((m) => m.trim()).filter(Boolean)
        : null;
      const created = await addTarget(id, {
        school_id: selectedSchool.id,
        intended_majors: majorsList,
        year_of_entry: yearOfEntry ? parseInt(yearOfEntry, 10) : null,
      });
      setTargets((prev) => [...prev, created]);
      setAddModalOpen(false);
      setSelectedSchool(null);
      setSchoolResults([]);
      setSchoolSearch('');
      setIntendedMajors('');
      setYearOfEntry('');
      setNewMajors([]);
      showToast('School added to target list.', 'success');
    } catch {
      showToast('Failed to add school.', 'error');
    } finally {
      setAddingTarget(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const headerStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const listContainerStyle = {
    maxWidth: '960px',
    margin: '0 auto',
    padding: 'var(--space-6) var(--space-8)',
  };

  const targetListStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: 'var(--shadow-sm)',
    border: 'var(--border-width) solid var(--color-border)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

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

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/students/${id}/profile`} style={backLinkStyle}>← Back to Profile</Link>

      {loading && <LoadingSpinner label="Loading target schools..." />}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && (
        <>
          <div style={headerStyle}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                {student?.full_name || 'Student'}
              </h1>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>Target Schools</p>
            </div>
            <Button onClick={() => setAddModalOpen(true)}>Add School</Button>
          </div>

          {targets.some(t => t.at_risk) && (
            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'var(--border-radius-sm)',padding:'var(--space-3) var(--space-4)',margin:'var(--space-4) var(--space-8)',display:'flex',alignItems:'flex-start',gap:'var(--space-3)'}}>
              <span style={{color:'#dc2626',fontSize:'var(--font-size-lg)',lineHeight:1}}>&#9888;</span>
              <div>
                <div style={{fontWeight:'var(--font-weight-bold)',color:'#991b1b',fontSize:'var(--font-size-sm)'}}>At-Risk Targets Detected</div>
                <div style={{color:'#7f1d1d',fontSize:'var(--font-size-xs)',marginTop:'2px'}}>
                  {targets.filter(t => t.at_risk).length} target(s) where predicted score falls below the programme's lower quartile.
                </div>
              </div>
            </div>
          )}

          <div style={listContainerStyle}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {['school', 'major'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: viewMode === mode ? 'var(--color-primary)' : 'none',
                    color: viewMode === mode ? '#fff' : 'var(--color-text-secondary)',
                    border: 'var(--border-width) solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family-base)',
                    fontWeight: viewMode === mode ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                  }}
                >
                  {mode === 'school' ? 'By School' : 'By Major'}
                </button>
              ))}
            </div>

            {targets.length === 0 ? (
              <EmptyState message="No target schools yet. Click 'Add School' to begin." />
            ) : viewMode === 'major' ? (
              <MajorView targets={targets} />
            ) : (
              <ul
                style={targetListStyle}
                aria-label="Target school preference list"
                role="list"
              >
                {targets.map((target, index) => (
                  <TargetSchoolRow
                    key={target.id}
                    target={target}
                    rank={index + 1}
                    isFirst={index === 0}
                    isLast={index === targets.length - 1}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    onRemove={() => handleRemove(target)}
                    onEdit={() => handleOpenEdit(target)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={addModalOpen}
        title="Add School to Target List"
        onClose={() => {
          setAddModalOpen(false);
          setSelectedSchool(null);
          setSchoolResults([]);
          setSchoolSearch('');
          setIntendedMajors('');
          setYearOfEntry('');
          setAutoRecs([]);
          setNewMajors([]);
        }}
        onConfirm={handleAddTarget}
        confirmLabel={addingTarget ? 'Adding…' : 'Add School'}
        confirmVariant="primary"
      >
        <div>
          {(recsLoading || autoRecs.length > 0) && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(37,99,235,0.04)', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-width) solid rgba(37,99,235,0.15)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
                Recommended for this student
              </div>
              {recsLoading ? (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Loading recommendations…</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {autoRecs.map((rec) => (
                    <li
                      key={rec.school_id ?? rec.id}
                      onClick={() => {
                        setSelectedSchool({ id: rec.school_id ?? rec.id, name: rec.school_name ?? rec.name });
                        setNewMajors(rec.major_name ? [rec.major_name] : []);
                        setIntendedMajors(rec.major_name ? rec.major_name : '');
                      }}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        cursor: 'pointer',
                        background: selectedSchool?.id === (rec.school_id ?? rec.id) ? 'rgba(37,99,235,0.08)' : 'transparent',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        border: selectedSchool?.id === (rec.school_id ?? rec.id) ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                        marginBottom: 'var(--space-1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{rec.school_name ?? rec.name}</div>
                        {rec.major_name && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginTop: '2px' }}>
                            {rec.major_name}{rec.major_jupas_code ? ` (${rec.major_jupas_code})` : ''}
                          </div>
                        )}
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {rec.fit_score ? `${Math.round(rec.fit_score * 100)}% fit` : '—'}
                        </div>
                      </div>
                      {rec.final_score != null && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: rec.final_score >= 0.7 ? 'var(--color-success)' : rec.final_score >= 0.4 ? 'var(--color-warning)' : 'var(--color-error)', fontWeight: 'var(--font-weight-medium)', flexShrink: 0 }}>
                          {Math.round(rec.final_score * 100)}% match
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label htmlFor="school-search-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Search Schools</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <input
              id="school-search-input"
              value={schoolSearch}
              onChange={(e) => setSchoolSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSchools(schoolSearch)}
              placeholder="School name…"
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
            />
            <Button onClick={() => handleSearchSchools(schoolSearch)} disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {schoolResults.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '240px', overflowY: 'auto' }}>
              {schoolResults.map((school) => (
                <li
                  key={school.id}
                  onClick={() => setSelectedSchool(school)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer',
                    background: selectedSchool?.id === school.id ? 'rgba(37,99,235,0.08)' : 'transparent',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    border: selectedSchool?.id === school.id ? 'var(--border-width) solid var(--color-primary)' : 'var(--border-width) solid transparent',
                    marginBottom: 'var(--space-1)',
                  }}
                  role="option"
                  aria-selected={selectedSchool?.id === school.id}
                >
                  {school.name} {school.name_zh && `(${school.name_zh})`}
                </li>
              ))}
            </ul>
          )}
          {selectedSchool && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
              Selected: <strong>{selectedSchool.name}</strong>
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <div style={{ flex: '2 1 180px' }}>
              <label htmlFor="intended-majors-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                Intended Major(s) <span style={{ color: 'var(--color-text-secondary)' }}>(comma-separated)</span>
              </label>
              <input
                id="intended-majors-input"
                value={intendedMajors}
                onChange={(e) => setIntendedMajors(e.target.value)}
                placeholder="e.g. Computer Science, Data Science"
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label htmlFor="year-of-entry-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                Year of Entry
              </label>
              <input
                id="year-of-entry-input"
                type="number"
                value={yearOfEntry}
                onChange={(e) => setYearOfEntry(e.target.value)}
                placeholder={new Date().getFullYear() + 1}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editTarget}
        title={`Edit: ${editTarget?.school_name ?? ''}`}
        onClose={() => setEditTarget(null)}
        onConfirm={handleEditSave}
        confirmLabel={editSaving ? 'Saving…' : 'Save'}
        confirmVariant="primary"
      >
        <div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
              Intended Major(s) <span style={{ color: 'var(--color-text-secondary)' }}>(comma-separated)</span>
            </label>
            <input
              value={editMajors}
              onChange={(e) => setEditMajors(e.target.value)}
              placeholder="e.g. Computer Science, Data Science"
              style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Year of Entry</label>
            <input
              type="number"
              value={editYear}
              onChange={(e) => setEditYear(e.target.value)}
              placeholder={new Date().getFullYear() + 1}
              style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Application Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">— Not set —</option>
              <option value="PLANNING">Planning</option>
              <option value="APPLIED">Applied</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
              Student Confidence
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'normal' }}> — how committed is the student to this choice?</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input
                type="range"
                min="1"
                max="5"
                value={editConfidence}
                onChange={(e) => setEditConfidence(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                aria-label="Student confidence level"
              />
              <span style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                minWidth: '90px',
                textAlign: 'right',
              }}>
                {editConfidence === 5 ? 'Decided' : editConfidence === 4 ? 'Strong' : editConfidence === 3 ? 'Interested' : editConfidence === 2 ? 'Exploring' : 'Unsure'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              <span>Unsure</span>
              <span>Decided</span>
            </div>
          </div>
        </div>
      </Modal>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default TargetSchools;
