// REQ-089, REQ-090, REQ-091, REQ-100: Tabbed Student Profile Page
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import Tabs from '../../components/Tabs/Tabs';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import Button from '../../components/Button/Button';
import TextInput from '../../components/TextInput/TextInput';
import StarRating from '../../components/StarRating/StarRating';
import FileUpload from '../../components/FileUpload/FileUpload';
import PredictedGradeBadge from '../../components/PredictedGradeBadge/PredictedGradeBadge';
import Toast from '../../components/Toast/Toast';
import { useToast } from '../../hooks/useToast';
import { getStudent, graduateStudent } from '../../api/students';
import { getAccount } from '../../api/account';
import { getGrades, createGrade, deleteGrade, getSubjects } from '../../api/grades';
import { uploadTranscript, getTranscript } from '../../api/transcripts';
import { generatePlan, getPlanHistory, deletePlanHistory } from '../../api/plan';
import client from '../../api/client';

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'grades', label: 'Grades' },
  { id: 'language', label: 'Language' },
  { id: 'evaluations', label: 'Teacher Evaluations' },
  { id: 'activities', label: 'Activities' },
  { id: 'notes', label: 'Notes' },
  { id: 'plans', label: 'Plans' },
];

// ---- Personal Tab ----
function PersonalTab({ studentId, student, onSaved, showToast }) {
  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    preferred_name: student?.preferred_name || '',
    date_of_birth: student?.date_of_birth || '',
    gender: student?.gender || '',
    address: student?.address || '',
    phone: student?.phone || '',
    email: student?.email || '',
    class_name: student?.class_name || '',
    year_of_study: student?.year_of_study ?? '',
    candidate_number: student?.candidate_number || '',
    financial_aid_flag: student?.financial_aid_flag || false,
    preferred_language: student?.preferred_language || 'en',
    personal_statement: student?.personal_statement || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        preferred_name: student.preferred_name || '',
        date_of_birth: student.date_of_birth || '',
        gender: student.gender || '',
        address: student.address || '',
        phone: student.phone || '',
        email: student.email || '',
        class_name: student.class_name || '',
        year_of_study: student.year_of_study ?? '',
        candidate_number: student.candidate_number || '',
        financial_aid_flag: student.financial_aid_flag || false,
        preferred_language: student.preferred_language || 'en',
        personal_statement: student.personal_statement || '',
      });
    }
  }, [student]);

  const calcAge = (dob) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      // Coerce empty strings to null for numeric/date fields so Pydantic doesn't reject them
      const payload = {
        ...form,
        year_of_study: form.year_of_study === '' || form.year_of_study === null ? null : parseInt(form.year_of_study, 10),
        date_of_birth: form.date_of_birth === '' ? null : form.date_of_birth,
        personal_statement: form.personal_statement === '' ? null : form.personal_statement,
      };
      const updated = await client.put(`/api/v1/students/${studentId}/profile`, payload).then((r) => r.data);
      onSaved(updated);
      showToast('Profile saved successfully.', 'success');
    } catch (err) {
      const detail = err?.response?.data;
      if (err?.response?.status === 422) {
        showToast(`Validation error: ${JSON.stringify(detail?.detail || detail)}`, 'error');
      } else {
        showToast('Failed to save profile.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-4) var(--space-6)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-1)',
  };

  const checkboxRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-4)',
  };

  const age = calcAge(form.date_of_birth);

  return (
    <div>
      <div style={gridStyle}>
        <TextInput label="Full Name" name="full_name" value={form.full_name} onChange={handleChange} error={errors.full_name} />
        <TextInput label="Preferred Name" name="preferred_name" value={form.preferred_name} onChange={handleChange} />
        <div>
          <TextInput label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />
          {age !== null && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0' }}>Age: {age}</p>
          )}
        </div>
        <TextInput label="Gender" name="gender" value={form.gender} onChange={handleChange} />
        <div style={{ gridColumn: '1 / -1' }}>
          <TextInput label="Address" name="address" value={form.address} onChange={handleChange} />
        </div>
        <TextInput label="Phone" name="phone" value={form.phone} onChange={handleChange} />
        <TextInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
        <TextInput label="Class" name="class_name" value={form.class_name} onChange={handleChange} />
        <TextInput label="Year of Study" name="year_of_study" type="number" value={form.year_of_study} onChange={handleChange} />
        <TextInput label="Candidate Number" name="candidate_number" value={form.candidate_number} onChange={handleChange} />
        <div>
          <label style={labelStyle}>Preferred Language</label>
          <select
            name="preferred_language"
            value={form.preferred_language}
            onChange={handleChange}
            style={{ padding: 'var(--space-2)', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%' }}
          >
            <option value="en">English</option>
            <option value="zh">Chinese (中文)</option>
          </select>
        </div>
      </div>
      <div style={checkboxRowStyle}>
        <input
          type="checkbox"
          id="financial_aid_flag"
          name="financial_aid_flag"
          checked={form.financial_aid_flag}
          onChange={handleChange}
        />
        <label htmlFor="financial_aid_flag" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
          Financial Aid Applicant
        </label>
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="personal_statement" style={labelStyle}>Personal Statement</label>
        <textarea
          id="personal_statement"
          name="personal_statement"
          value={form.personal_statement}
          onChange={handleChange}
          placeholder="Write a personal statement for university applications…"
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 'var(--space-2)',
            border: 'var(--border-width) solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family-base)',
            resize: 'vertical',
            lineHeight: '1.5',
          }}
        />
      </div>
      <Button label="Save" onClick={handleSave} loading={saving} />
    </div>
  );
}

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

// ---- Grades Tab ----
function GradesTab({ studentId, showToast, subjects }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [transcriptState, setTranscriptState] = useState('idle'); // idle|parsing|complete|failed
  const [parsedGrades, setParsedGrades] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    getGrades(studentId)
      .then((data) => setGrades(Array.isArray(data) ? data : (data.grades || [])))
      .catch(() => setError('Failed to load grades.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleUpload = async (file) => {
    setUploadProgress(0);
    try {
      await uploadTranscript(studentId, file);
      setUploadProgress(100);
      setTranscriptState('parsing');
      showToast('Transcript uploaded. Parsing in progress\u2026', 'info');
      pollRef.current = setInterval(async () => {
        try {
          const result = await getTranscript(studentId);
          if (result.parse_status === 'complete') {
            clearInterval(pollRef.current);
            setTranscriptState('complete');
            setParsedGrades(result.parsed_data || []);
            showToast('Transcript parsed. Review suggested grades below.', 'success');
          } else if (result.parse_status === 'failed') {
            clearInterval(pollRef.current);
            setTranscriptState('failed');
            showToast('Transcript parsing failed. Please enter grades manually.', 'error');
          }
        } catch {
          clearInterval(pollRef.current);
          setTranscriptState('failed');
        }
      }, 3000);
    } catch {
      setUploadProgress(null);
      showToast('Upload failed.', 'error');
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleAcceptSuggestion = async (suggestion) => {
    try {
      const created = await createGrade(studentId, {
        subject_name: suggestion.subject,
        raw_grade: suggestion.grade,
        sitting: 'OFFICIAL',
        transcript_uploaded: true,
      });
      setGrades((prev) => [...prev, created]);
      setParsedGrades((prev) => prev.filter((g) => g !== suggestion));
      showToast('Grade added.', 'success');
    } catch {
      showToast('Failed to add grade.', 'error');
    }
  };

  const handleDeleteGrade = async (gradeId) => {
    try {
      await deleteGrade(studentId, gradeId);
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
      showToast('Grade deleted.', 'success');
    } catch {
      showToast('Failed to delete grade.', 'error');
    }
  };

  const handleSaveNewRow = async () => {
    if (!newRow?.subject_name) return;
    try {
      const created = await createGrade(studentId, newRow);
      setGrades((prev) => [...prev, created]);
      setNewRow(null);
      showToast('Grade added.', 'success');
    } catch {
      showToast('Failed to save grade.', 'error');
    }
  };

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
            Transcript uploaded. Parsing in progress…
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
              <Button label="Dismiss" variant="secondary" onClick={() => setParsedGrades((prev) => prev.filter((_, idx) => idx !== i))} />
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
                  ) : '—'}
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
                <option value="">Select subject…</option>
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
                <option value="">—</option>
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

// ---- Language Tab ----
function LanguageTab({ studentId, student, onSaved, showToast }) {
  const [ielts, setIelts] = useState({
    ielts_score: student?.ielts_score || '',
    ielts_listening: student?.ielts_listening || '',
    ielts_reading: student?.ielts_reading || '',
    ielts_writing: student?.ielts_writing || '',
    ielts_speaking: student?.ielts_speaking || '',
    ielts_date: student?.ielts_date || '',
  });
  const [otherScores, setOtherScores] = useState(student?.other_language_scores || []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await client.post(`/api/v1/students/${studentId}/language-scores`, {
        ...ielts,
        other_language_scores: otherScores,
      }).then((r) => r.data);
      onSaved(updated);
      showToast('Language scores saved.', 'success');
    } catch {
      showToast('Failed to save language scores.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addOtherScore = () => {
    setOtherScores((prev) => [...prev, { label: '', score: '', date: '' }]);
  };

  const removeOtherScore = (index) => {
    setOtherScores((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOtherScore = (index, field, value) => {
    setOtherScores((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <h3 style={sectionHeadingStyle}>IELTS</h3>
      <div style={gridStyle}>
        {[
          ['Overall Band', 'ielts_score'],
          ['Listening', 'ielts_listening'],
          ['Reading', 'ielts_reading'],
          ['Writing', 'ielts_writing'],
          ['Speaking', 'ielts_speaking'],
          ['Test Date', 'ielts_date'],
        ].map(([label, field]) => (
          <div key={field}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }} htmlFor={`ielts-${field}`}>{label}</label>
            <input
              id={`ielts-${field}`}
              type={field === 'ielts_date' ? 'date' : 'number'}
              value={ielts[field]}
              onChange={(e) => setIelts((prev) => ({ ...prev, [field]: e.target.value }))}
              step={field !== 'ielts_date' ? '0.5' : undefined}
              min={field !== 'ielts_date' ? '0' : undefined}
              max={field !== 'ielts_date' ? '9' : undefined}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <h3 style={sectionHeadingStyle}>Other Language Scores</h3>
      {otherScores.map((score, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Label</label>
            <input value={score.label} onChange={(e) => updateOtherScore(index, 'label', e.target.value)} style={inputStyle} aria-label="Score label" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Score</label>
            <input value={score.score} onChange={(e) => updateOtherScore(index, 'score', e.target.value)} style={inputStyle} aria-label="Score value" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Date</label>
            <input type="date" value={score.date} onChange={(e) => updateOtherScore(index, 'date', e.target.value)} style={inputStyle} aria-label="Score date" />
          </div>
          <button
            onClick={() => removeOtherScore(index)}
            style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', alignSelf: 'center', paddingBottom: 'var(--space-1)' }}
            aria-label="Remove score"
          >
            Remove
          </button>
        </div>
      ))}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button label="Add Score" variant="secondary" onClick={addOtherScore} />
      </div>
      <Button label="Save" onClick={handleSave} loading={saving} />
    </div>
  );
}

// ---- Teacher Evaluations Tab ----
function EvaluationsTab({ studentId, showToast }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    client.get(`/api/v1/students/${studentId}/teacher-evaluations`)
      .then((r) => setEvaluations(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEvaluations([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  const saveAll = async (updatedList) => {
    setSaving('all');
    try {
      const r = await client.put(`/api/v1/students/${studentId}/teacher-evaluations`, updatedList).then((res) => res.data);
      setEvaluations(Array.isArray(r) ? r : updatedList);
      showToast('Evaluations saved.', 'success');
    } catch {
      showToast('Failed to save evaluations.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const addEval = () => {
    setEvaluations((prev) => [...prev, { subject_code: '', teacher_name: '', rating: 0, comment: '', date: '' }]);
  };

  const updateEval = (index, field, value) => {
    setEvaluations((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const removeEval = (index) => {
    const next = evaluations.filter((_, i) => i !== index);
    saveAll(next);
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-5)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
  };

  if (loading) return <LoadingSpinner label="Loading evaluations..." />;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button label="Add Evaluation" variant="secondary" onClick={addEval} />
      </div>
      {evaluations.map((ev, index) => (
        <div key={index} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Subject</label>
              <input value={ev.subject_code || ''} onChange={(e) => updateEval(index, 'subject_code', e.target.value)} style={inputStyle} aria-label="Subject code" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Teacher Name</label>
              <input value={ev.teacher_name || ''} onChange={(e) => updateEval(index, 'teacher_name', e.target.value)} style={inputStyle} aria-label="Teacher name" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Rating</label>
            <StarRating value={ev.rating} onChange={(v) => updateEval(index, 'rating', v)} label={ev.subject_code || `Evaluation ${index + 1}`} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Comment</label>
            <textarea
              value={ev.comment || ''}
              onChange={(e) => updateEval(index, 'comment', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              aria-label="Teacher comment"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Date</label>
            <input type="date" value={ev.date || ''} onChange={(e) => updateEval(index, 'date', e.target.value)} style={inputStyle} aria-label="Evaluation date" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button label="Save" onClick={() => saveAll(evaluations)} loading={saving === 'all'} />
            <Button label="Delete" variant="danger" onClick={() => removeEval(index)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Activities Tab ----
function ActivitiesTab({ studentId, student, showToast }) {
  const [activities, setActivities] = useState(student?.extra_curricular || []);
  const [awards, setAwards] = useState(student?.awards || []);
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-4)',
    marginBottom: 'var(--space-3)',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  const handleSaveActivities = async () => {
    setSaving(true);
    try {
      await client.post(`/api/v1/students/${studentId}/extracurricular`, activities).then((r) => r.data);
      showToast('Activities saved.', 'success');
    } catch {
      showToast('Failed to save activities.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAwards = async () => {
    setSaving(true);
    try {
      await client.post(`/api/v1/students/${studentId}/awards`, awards).then((r) => r.data);
      showToast('Awards saved.', 'success');
    } catch {
      showToast('Failed to save awards.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 style={sectionHeadingStyle}>Extracurricular Activities</h3>
      {activities.map((act, index) => (
        <div key={index} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Activity</label>
              <input value={act.activity || ''} onChange={(e) => setActivities((prev) => prev.map((a, i) => i === index ? { ...a, activity: e.target.value } : a))} style={inputStyle} aria-label="Activity name" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Role</label>
              <input value={act.role || ''} onChange={(e) => setActivities((prev) => prev.map((a, i) => i === index ? { ...a, role: e.target.value } : a))} style={inputStyle} aria-label="Role" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Years</label>
              <input value={act.years || ''} onChange={(e) => setActivities((prev) => prev.map((a, i) => i === index ? { ...a, years: e.target.value } : a))} style={inputStyle} aria-label="Years participated" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Achievement</label>
              <input value={act.achievement || ''} onChange={(e) => setActivities((prev) => prev.map((a, i) => i === index ? { ...a, achievement: e.target.value } : a))} style={inputStyle} aria-label="Achievement" />
            </div>
          </div>
          <button onClick={() => setActivities((prev) => prev.filter((_, i) => i !== index))} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>Remove</button>
        </div>
      ))}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button label="Add Activity" variant="secondary" onClick={() => setActivities((prev) => [...prev, { activity: '', role: '', years: '', achievement: '' }])} />
        <Button label="Save Activities" onClick={handleSaveActivities} loading={saving} />
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3 style={sectionHeadingStyle}>Awards</h3>
        {awards.map((aw, index) => (
          <div key={index} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Title</label>
                <input value={aw.title || ''} onChange={(e) => setAwards((prev) => prev.map((a, i) => i === index ? { ...a, title: e.target.value } : a))} style={inputStyle} aria-label="Award title" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Awarding Body</label>
                <input value={aw.awarding_body || ''} onChange={(e) => setAwards((prev) => prev.map((a, i) => i === index ? { ...a, awarding_body: e.target.value } : a))} style={inputStyle} aria-label="Awarding body" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Level</label>
                <select value={aw.level || 'School'} onChange={(e) => setAwards((prev) => prev.map((a, i) => i === index ? { ...a, level: e.target.value } : a))} style={inputStyle} aria-label="Award level">
                  <option value="School">School</option>
                  <option value="District">District</option>
                  <option value="Regional">Regional</option>
                  <option value="International">International</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Year</label>
                <input type="number" value={aw.year || ''} onChange={(e) => setAwards((prev) => prev.map((a, i) => i === index ? { ...a, year: e.target.value } : a))} style={inputStyle} aria-label="Year received" />
              </div>
            </div>
            <button onClick={() => setAwards((prev) => prev.filter((_, i) => i !== index))} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>Remove</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button label="Add Award" variant="secondary" onClick={() => setAwards((prev) => [...prev, { title: '', awarding_body: '', level: 'School', year: '' }])} />
          <Button label="Save Awards" onClick={handleSaveAwards} loading={saving} />
        </div>
      </div>
    </div>
  );
}

// ---- Plans Tab ----
function PlansTab({ studentId, showToast }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    getPlanHistory(studentId)
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => showToast('Failed to load plan history.', 'error'))
      .finally(() => setLoading(false));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (e, planId) => {
    e.stopPropagation();
    setDeleting(planId);
    try {
      await deletePlanHistory(studentId, planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      if (selected?.id === planId) setSelected(null);
      showToast('Plan deleted.', 'success');
    } catch {
      showToast('Failed to delete plan.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-4)',
    marginBottom: 'var(--space-3)',
    cursor: 'pointer',
  };

  const iframeStyle = {
    width: '100%',
    minHeight: '600px',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    background: '#fff',
    marginTop: 'var(--space-4)',
  };

  if (loading) return <LoadingSpinner label="Loading plan history…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
          Saved Plans ({plans.length})
        </h2>
        <Button label="Generate New Plan" variant="primary" onClick={() => navigate(`/students/${studentId}/plan`)} />
      </div>

      {plans.length === 0 && (
        <EmptyState message="No plans saved yet. Click 'Generate New Plan' to create one." />
      )}

      {selected && (
        <div>
          <button
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-family-base)' }}
          >
            ← Back to plan list
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', margin: 0 }}>{selected.plan_label}</h3>
            <button
              onClick={(e) => handleDelete(e, selected.id)}
              disabled={deleting === selected.id}
              style={{ color: 'var(--color-error)', background: 'none', border: 'var(--border-width) solid var(--color-error)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', padding: 'var(--space-1) var(--space-3)' }}
            >
              {deleting === selected.id ? 'Deleting…' : 'Delete Plan'}
            </button>
          </div>
          {selected.snapshot_data && (
            <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <strong>Snapshot at generation time:</strong> {(selected.snapshot_data.subject_grades || []).length} subjects · Best-5 aggregate: {selected.snapshot_data.best5_aggregate ?? 'N/A'}
              {selected.recommended_schools?.length > 0 && ` · ${selected.recommended_schools.length} recommended schools`}
            </div>
          )}
          {selected.html_content ? (
            <iframe
              style={iframeStyle}
              srcDoc={selected.html_content}
              title={selected.plan_label}
              sandbox="allow-same-origin"
            />
          ) : (
            <EmptyState message="Plan content was not stored for this entry." />
          )}
        </div>
      )}

      {!selected && plans.map((plan) => (
        <div
          key={plan.id}
          style={cardStyle}
          onClick={() => setSelected(plan)}
          role="button"
          tabIndex={0}
          aria-label={`View ${plan.plan_label}`}
          onKeyDown={(e) => e.key === 'Enter' && setSelected(plan)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {plan.plan_label || `Plan v${plan.version}`}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {plan.generated_at ? plan.generated_at.slice(0, 16).replace('T', ' ') : 'Date unknown'}
              </div>
              {plan.snapshot_data && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {(plan.snapshot_data.subject_grades || []).length} subjects · Best-5: {plan.snapshot_data.best5_aggregate ?? '?'}
                  {plan.recommended_schools?.length > 0 && ` · ${plan.recommended_schools.length} recommended`}
                </div>
              )}
            </div>
            <button
              onClick={(e) => handleDelete(e, plan.id)}
              disabled={deleting === plan.id}
              style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-base)', padding: 'var(--space-1)' }}
            >
              {deleting === plan.id ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Notes Tab ----
function NotesTab({ studentId, student, onSaved, showToast }) {
  const [notes, setNotes] = useState(student?.notes || '');
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const fadeRef = useRef(null);

  const autoSave = useCallback(async (value) => {
    setSaveStatus('saving');
    try {
      const updated = await client.put(`/api/v1/students/${studentId}/profile`, { notes: value }).then((r) => r.data);
      onSaved(updated);
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus(null);
      showToast('Auto-save failed.', 'error');
    }
  }, [studentId, onSaved, showToast]);

  const handleChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
    debounceRef.current = setTimeout(() => autoSave(value), 1500);
  };

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <label htmlFor="counsellor-notes" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
          Counsellor Notes
        </label>
        {saveStatus === 'saving' && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>✓ Saved</span>
        )}
      </div>
      <textarea
        id="counsellor-notes"
        value={notes}
        onChange={handleChange}
        rows={12}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-3)',
          border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 'var(--font-size-md)',
          fontFamily: 'var(--font-family-base)',
          color: 'var(--color-text-primary)',
          resize: 'vertical',
          lineHeight: 'var(--line-height-normal)',
        }}
        aria-label="Counsellor notes"
      />
    </div>
  );
}

// ---- Main StudentProfile ----
function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, removeToast } = useToast();
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [graduateForm, setGraduateForm] = useState({ final_school_id: '', final_major: '', graduation_year: new Date().getFullYear() });
  const [graduateLoading, setGraduateLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const activeTab = searchParams.get('tab') || 'personal';

  useEffect(() => {
    Promise.all([
      getStudent(id).catch(() => client.get(`/api/v1/students/${id}/profile`).then((r) => r.data)),
      getAccount(),
    ])
      .then(([studentData, accountData]) => {
        setStudent(studentData);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to load student profile.');
      })
      .finally(() => setLoading(false));
    getSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, [id]);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleStudentSaved = (updated) => {
    setStudent(updated);
  };

  const handleOpenGraduate = async () => {
    setShowGraduateModal(true);
    if (schoolOptions.length === 0) {
      try {
        const { searchSchools } = await import('../../api/schoolsV2');
        const res = await searchSchools({ limit: 100 });
        setSchoolOptions(Array.isArray(res) ? res : (res.items ?? []));
      } catch { /* non-critical */ }
    }
  };

  const handleGraduate = async () => {
    setGraduateLoading(true);
    try {
      const payload = {
        final_school_id: graduateForm.final_school_id || null,
        final_major: graduateForm.final_major || null,
        graduation_year: graduateForm.graduation_year ? parseInt(graduateForm.graduation_year, 10) : null,
      };
      const updated = await graduateStudent(id, payload);
      setStudent(updated);
      setShowGraduateModal(false);
      showToast('Student marked as graduated. Data added to analytics.', 'success');
    } catch {
      showToast('Failed to graduate student.', 'error');
    } finally {
      setGraduateLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      await generatePlan(id);
      navigate(`/students/${id}/plan`);
    } catch {
      showToast('Failed to start plan generation.', 'error');
      setGeneratingPlan(false);
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

  const headerLeftStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  };

  const studentNameStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const studentMetaStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    margin: 0,
  };

  const actionBtnRowStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
  };

  const contentStyle = {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '0 var(--space-8)',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to="/dashboard" style={backLinkStyle}>← Back to Dashboard</Link>

      {loading && <LoadingSpinner label="Loading student profile..." />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
          <Link to="/dashboard" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>Back to Dashboard</Link>
        </div>
      )}

      {!loading && !error && student && (
        <>
          <div style={headerStyle}>
            <div style={headerLeftStyle}>
              <h1 style={studentNameStyle}>{student.full_name || 'Student Profile'}</h1>
              {student.year_of_study && (
                <p style={studentMetaStyle}>Year {student.year_of_study}</p>
              )}
            </div>
            <div style={actionBtnRowStyle}>
              {student.is_graduated && (
                <span style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-success)', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontWeight: 'var(--font-weight-medium)' }}>
                  Graduated {student.graduation_year || ''}
                </span>
              )}
              {!student.is_graduated && (
                <Button
                  label="Mark as Graduated"
                  variant="secondary"
                  onClick={handleOpenGraduate}
                />
              )}
              <Button
                label="Target Schools"
                variant="secondary"
                onClick={() => navigate(`/students/${id}/targets`)}
              />
              <Button
                label="Generate Plan"
                variant="primary"
                onClick={handleGeneratePlan}
                loading={generatingPlan}
              />
            </div>
          </div>

          <div style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', position: 'sticky', top: '56px', zIndex: 50 }}>
            <Tabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange}>
              <div />
            </Tabs>
          </div>

          <div style={contentStyle}>
            {activeTab === 'personal' && (
              <PersonalTab studentId={id} student={student} onSaved={handleStudentSaved} showToast={showToast} />
            )}
            {activeTab === 'grades' && (
              <GradesTab studentId={id} showToast={showToast} subjects={subjects} />
            )}
            {activeTab === 'language' && (
              <LanguageTab studentId={id} student={student} onSaved={handleStudentSaved} showToast={showToast} />
            )}
            {activeTab === 'evaluations' && (
              <EvaluationsTab studentId={id} showToast={showToast} />
            )}
            {activeTab === 'activities' && (
              <ActivitiesTab studentId={id} student={student} showToast={showToast} />
            )}
            {activeTab === 'notes' && (
              <NotesTab studentId={id} student={student} onSaved={handleStudentSaved} showToast={showToast} />
            )}
            {activeTab === 'plans' && (
              <PlansTab studentId={id} showToast={showToast} />
            )}
          </div>
        </>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />

      {showGraduateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-6)', width: '440px', maxWidth: '95vw', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>Mark as Graduated</h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              This will move the student to the alumni record and add their data to the analytics data store (grades and final destination will be anonymized).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>Final School</label>
                <select
                  value={graduateForm.final_school_id}
                  onChange={(e) => setGraduateForm((f) => ({ ...f, final_school_id: e.target.value }))}
                  style={{ width: '100%', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                >
                  <option value="">None / Unknown</option>
                  {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>Final Major</label>
                <input
                  value={graduateForm.final_major}
                  onChange={(e) => setGraduateForm((f) => ({ ...f, final_major: e.target.value }))}
                  placeholder="e.g. Computer Science"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>Graduation Year</label>
                <input
                  type="number"
                  value={graduateForm.graduation_year}
                  onChange={(e) => setGraduateForm((f) => ({ ...f, graduation_year: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
              <Button label="Cancel" variant="secondary" onClick={() => setShowGraduateModal(false)} disabled={graduateLoading} />
              <Button label={graduateLoading ? 'Saving…' : 'Confirm Graduate'} variant="primary" onClick={handleGraduate} disabled={graduateLoading} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentProfile;
