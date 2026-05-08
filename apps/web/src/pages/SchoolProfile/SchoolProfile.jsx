// REQ-095: School Profile Page
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { toast } from 'sonner';
import { Modal } from '@schoolchoice/ui';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { FormCard } from '@schoolchoice/ui';
import { getSchoolV2 } from '../../api/schoolsV2';
import { addTarget } from '../../api/targets';
import { getStudents } from '../../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';

function SchoolProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [school, setSchool] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToTarget, setAddedToTarget] = useState(false);
  const [selectStudentModalOpen, setSelectStudentModalOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [addingTarget, setAddingTarget] = useState(false);

  const fromStudentId = searchParams.get('from_student');

  useEffect(() => {
    Promise.all([getSchoolV2(id), getAccount()])
      .then(([schoolData, accountData]) => {
        setSchool(schoolData);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to load school profile.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToTargetWithStudent = async (studentId) => {
    setAddingTarget(true);
    try {
      await addTarget(studentId, { school_id: id });
      setAddedToTarget(true);
      setSelectStudentModalOpen(false);
      toast.success('School added to target list.');
    } catch (err) {
      if (err?.response?.status === 409) {
        toast('This school is already in the target list.');
      } else {
        toast.error('Failed to add school to target list.');
      }
    } finally {
      setAddingTarget(false);
    }
  };

  const handleAddToTarget = async () => {
    if (fromStudentId) {
      await handleAddToTargetWithStudent(fromStudentId);
    } else {
      const result = await getStudents();
      const list = Array.isArray(result) ? result : (result.items ?? []);
      setStudents(list);
      setSelectStudentModalOpen(true);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const heroStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-6) var(--space-8)',
  };

  const schoolNameStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: '0 0 var(--space-1) 0',
  };

  const schoolNameZhStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-normal)',
    color: 'var(--color-text-secondary)',
    margin: '0 0 var(--space-3) 0',
  };

  const typeBadgeStyle = {
    display: 'inline-block',
    background: 'var(--color-background)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    marginRight: 'var(--space-2)',
  };

  const metaStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    display: 'inline',
    marginRight: 'var(--space-4)',
  };

  const contentStyle = {
    padding: 'var(--space-6) var(--space-8)',
    display: 'grid',
    gridTemplateColumns: '60% 1fr',
    gap: 'var(--space-8)',
    maxWidth: '1200px',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-4)',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--font-size-sm)',
    marginBottom: 'var(--space-4)',
  };

  const thStyle = {
    textAlign: 'left',
    padding: 'var(--space-2)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
  };

  const tdStyle = {
    padding: 'var(--space-2)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    color: 'var(--color-text-primary)',
  };

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--space-3) 0',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    fontSize: 'var(--font-size-sm)',
  };

  const provenanceStyle = {
    background: 'var(--color-background)',
    borderTop: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  const selectStyle = {
    width: '100%',
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    marginBottom: 'var(--space-4)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to="/schools" style={backLinkStyle}>← Back to Directory</Link>

      {loading && <LoadingSpinner label="Loading school profile..." />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
          <Link to="/schools" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>Back to Directory</Link>
        </div>
      )}

      {!loading && !error && school && (
        <>
          <div style={heroStyle}>
            <h1 style={schoolNameStyle}>{school.name}</h1>
            {school.name_zh && <p style={schoolNameZhStyle}>{school.name_zh}</p>}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <span style={typeBadgeStyle}>{school.type}</span>
              {school.location && <span style={metaStyle}>{'\u{1F4CD}'} {school.location}</span>}
              {school.website && (
                <a
                  href={school.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...metaStyle, color: 'var(--color-primary)', textDecoration: 'none' }}
                  aria-label={`Visit ${school.name} website (opens in new tab)`}
                >
                  Website ↗
                </a>
              )}
            </div>
            {school.description && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '720px', lineHeight: 'var(--line-height-normal)' }}>
                {school.description}
              </p>
            )}
          </div>

          <div style={contentStyle}>
            <div>
              <section aria-label="Admission Requirements" style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={sectionHeadingStyle}>Admission Requirements</h2>
                <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
                  <strong>Minimum HKDSE Aggregate:</strong>{' '}
                  {school.minimum_entry_score != null ? school.minimum_entry_score : 'Not specified.'}
                </p>
                {school.required_subjects && school.required_subjects.length > 0 ? (
                  <table style={tableStyle} aria-label="Required subjects">
                    <thead>
                      <tr>
                        <th style={thStyle}>Subject Code</th>
                        <th style={thStyle}>Minimum Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {school.required_subjects.map((req, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>{req.subject_code}</td>
                          <td style={tdStyle}>{req.minimum_grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>No specific subject requirements listed.</p>
                )}
                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                  <strong>IELTS Requirement:</strong>{' '}
                  {school.language_requirements?.ielts_minimum != null
                    ? school.language_requirements.ielts_minimum
                    : 'No IELTS requirement listed.'}
                </p>
              </section>

              <section aria-label="Programs">
                <h2 style={sectionHeadingStyle}>Programs</h2>
                {school.faculties && school.faculties.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>Faculties</h3>
                    <ul style={{ fontSize: 'var(--font-size-sm)', paddingLeft: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                      {school.faculties.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </>
                )}
                {school.notable_programs && school.notable_programs.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>Notable Programs</h3>
                    <ul style={{ fontSize: 'var(--font-size-sm)', paddingLeft: 'var(--space-5)' }}>
                      {school.notable_programs.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </>
                )}
              </section>

              <section aria-label="Requirements by Major" style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <h2 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Requirements by Major</h2>
                </div>
                {Array.isArray(school.major_requirements) && school.major_requirements.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {school.major_requirements.map((req) => (
                      <div key={req.major} style={{ background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3)', border: 'var(--border-width) solid var(--color-border)' }}>
                        <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                          {req.major}
                          {req.jupas_code && <span style={{ marginLeft: 'var(--space-2)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-secondary)' }}>{req.jupas_code}</span>}
                        </div>
                        {req.minimum_score != null && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Min. aggregate: {req.minimum_score}</div>}
                        {req.average_score != null && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Avg. admitted: {req.average_score}</div>}
                        {req.required_subjects && req.required_subjects.length > 0 && (
                          <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>
                            <span style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--space-1)' }}>Required:</span>
                            <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
                              {req.required_subjects.map((s, si) => (
                                <span key={si} style={{ background: 'rgba(220,38,38,0.08)', border: 'var(--border-width) solid rgba(220,38,38,0.2)', borderRadius: '4px', padding: '1px 6px', color: 'var(--color-error)' }}>
                                  {s.subject_code}{s.min_grade ? ` ≥${s.min_grade}` : ''}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                        {req.preferred_subjects && req.preferred_subjects.length > 0 && (
                          <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>
                            <span style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--space-1)' }}>Preferred:</span>
                            <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
                              {req.preferred_subjects.map((s, si) => (
                                <span key={si} style={{ background: 'rgba(37,99,235,0.08)', border: 'var(--border-width) solid rgba(37,99,235,0.2)', borderRadius: '4px', padding: '1px 6px', color: 'var(--color-primary)' }}>
                                  {typeof s === 'string' ? s : s.subject_code}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                        {req.notes && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>{req.notes}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>No per-major requirement data available.</p>
                )}
              </section>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <FormCard title="Statistics">
                <div style={statRowStyle}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Acceptance Rate</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                    {school.acceptance_rate != null ? `${Math.round(school.acceptance_rate * 100)}%` : 'N/A'}
                  </span>
                </div>
                <div style={statRowStyle}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Avg. Admitted Score</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                    {school.average_admitted_score != null ? school.average_admitted_score : 'N/A'}
                  </span>
                </div>
                <div style={{ ...statRowStyle, borderBottom: 'none' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Scholarship Available</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: school.scholarship_available ? 'var(--color-success)' : 'inherit' }}>
                    {school.scholarship_available ? 'Yes' : 'No'}
                  </span>
                </div>
              </FormCard>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {addedToTarget ? (
                  <Button disabled variant="outline">Already in Target List</Button>
                ) : (
                  <Button onClick={handleAddToTarget} disabled={addingTarget}>
                    {addingTarget ? 'Adding...' : (fromStudentId ? 'Add to Target List' : 'Select Student & Add')}
                  </Button>
                )}
                <Link to="/schools">
                  <Button variant="outline">Back to Directory</Button>
                </Link>
              </div>
            </div>
          </div>

          {(school.data_source || school.data_last_updated) && (
            <div style={provenanceStyle}>
              {school.data_source && <span>Source: {school.data_source}</span>}
              {school.data_source && school.data_last_updated && <span> &middot; </span>}
              {school.data_last_updated && (
                <span>Last updated: {school.data_last_updated.slice(0, 10)}</span>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={selectStudentModalOpen}
        title="Select Student"
        onClose={() => setSelectStudentModalOpen(false)}
        onConfirm={() => selectedStudentId && handleAddToTargetWithStudent(selectedStudentId)}
        confirmLabel="Add to Target List"
      >
        <div>
          <label htmlFor="student-select" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
            Select a student to add {school?.name} to their target list:
          </label>
          <select
            id="student-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            style={selectStyle}
            aria-label="Select student"
          >
            <option value="">Choose a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name || s.name}</option>
            ))}
          </select>
        </div>
      </Modal>

    </div>
  );
}

export default SchoolProfile;
