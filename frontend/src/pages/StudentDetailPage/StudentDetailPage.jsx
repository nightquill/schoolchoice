// REQ-033: Student Profile Management - Student detail with edit, recommendations, action plan
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import NavBar from '../../components/NavBar/NavBar';
import StudentForm from '../../components/StudentForm/StudentForm';
import ActionPlanDisplay from '../../components/ActionPlanDisplay/ActionPlanDisplay';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import Button from '../../components/Button/Button';
import { getStudent, updateStudent } from '../../api/students';
import { generateRecommendations } from '../../api/recommendations';
import { generateActionPlan, getActionPlan } from '../../api/actionPlan';

function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [studentError, setStudentError] = useState('');

  const [actionPlan, setActionPlan] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [genLoading, setGenLoading] = useState(false);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [actionPlanSuccess, setActionPlanSuccess] = useState('');

  const anyLoading = genLoading || actionPlanLoading || editLoading;

  useEffect(() => {
    const fetchStudent = async () => {
      setStudentLoading(true);
      setStudentError('');
      try {
        const data = await getStudent(id);
        setStudent(data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) setStudentError('Student not found.');
        else if (status === 403) setStudentError('You do not have access to this student record.');
        else setStudentError('Could not load student data. Please try again.');
      } finally {
        setStudentLoading(false);
      }
    };

    const fetchActionPlan = async () => {
      try {
        const data = await getActionPlan(id);
        setActionPlan(data);
      } catch {
        // 404 means no action plan yet — that's fine
      }
    };

    fetchStudent();
    fetchActionPlan();
  }, [id]);

  const handleEdit = async (formData) => {
    setEditLoading(true);
    try {
      const updated = await updateStudent(id, formData);
      setStudent(updated);
      setIsEditing(false);
      setSuccessMessage('Changes saved.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch {
      // Error is surfaced via form
    } finally {
      setEditLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setGenLoading(true);
    setActionError('');
    try {
      await generateRecommendations(id);
      await generateActionPlan(id);
      navigate(`/students/${id}/recommendations`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        setActionError('The student profile is incomplete. Please ensure all required fields are filled in before generating recommendations.');
      } else if (status === 404) {
        setActionError('Student not found.');
      } else {
        setActionError('Could not generate recommendations. Please try again.');
      }
    } finally {
      setGenLoading(false);
    }
  };

  const handleGenerateActionPlan = async () => {
    setActionPlanLoading(true);
    setActionError('');
    try {
      const data = await generateActionPlan(id);
      setActionPlan(data);
      setActionPlanSuccess('Action plan generated.');
      setTimeout(() => setActionPlanSuccess(''), 3000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        setActionError('The student profile is incomplete. Please ensure all fields are filled in before generating an action plan.');
      } else {
        setActionError('Could not generate action plan. Please try again.');
      }
    } finally {
      setActionPlanLoading(false);
    }
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '960px',
    margin: '0 auto',
    padding: 'var(--space-8) var(--space-6)',
  };

  const backLinkStyle = {
    color: 'var(--color-primary)',
    fontSize: 'var(--font-size-sm)',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 'var(--space-2)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    marginBottom: 'var(--space-6)',
  };

  const infoCardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-6)',
    marginBottom: 'var(--space-6)',
  };

  const labelStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-1)',
    display: 'block',
  };

  const valueStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
  };

  const tagStyle = {
    display: 'inline-block',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: '2px var(--space-2)',
    marginRight: 'var(--space-1)',
    marginBottom: 'var(--space-1)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
  };

  const buttonRowStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-6)',
    flexWrap: 'wrap',
  };

  const successStyle = {
    color: 'var(--color-success)',
    fontSize: 'var(--font-size-sm)',
    marginBottom: 'var(--space-4)',
  };

  const actionPlanSectionStyle = {
    marginTop: 'var(--space-8)',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  if (studentLoading) {
    return (
      <div style={pageStyle}>
        <NavBar />
        <div style={contentStyle}>
          <LoadingSpinner label="Loading…" />
        </div>
      </div>
    );
  }

  if (studentError) {
    return (
      <div style={pageStyle}>
        <NavBar />
        <div style={contentStyle}>
          <ErrorMessage message={studentError} />
          <Link to="/students" style={backLinkStyle}>Back to Students</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <NavBar />
      <div style={contentStyle}>
        <Link to="/students" style={backLinkStyle}>{'< Back to Students'}</Link>
        <h1 style={headingStyle}>{student.name}</h1>

        {successMessage && <p style={successStyle}>{successMessage}</p>}

        {isEditing ? (
          <div style={infoCardStyle}>
            <StudentForm
              initialData={student}
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              loading={editLoading}
              submitLabel="Save Changes"
            />
          </div>
        ) : (
          <>
            <div style={infoCardStyle}>
              <div>
                <span style={labelStyle}>Name</span>
                <div style={valueStyle}>{student.name}</div>
              </div>
              <div>
                <span style={labelStyle}>Target Region</span>
                <div style={valueStyle}>
                  {student.target_region === 'local' ? 'Local' : 'International'}
                </div>
              </div>
              <div>
                <span style={labelStyle}>Grades</span>
                <div style={valueStyle}>
                  {student.grades && Object.keys(student.grades).length > 0
                    ? Object.entries(student.grades).map(([subject, grade]) => (
                        <div key={subject}>{subject}: {grade}</div>
                      ))
                    : <span style={{ color: 'var(--color-text-secondary)' }}>No grades recorded</span>
                  }
                </div>
              </div>
              <div>
                <span style={labelStyle}>Interests</span>
                <div style={valueStyle}>
                  {student.interests && student.interests.length > 0
                    ? student.interests.map((interest) => (
                        <span key={interest} style={tagStyle}>{interest}</span>
                      ))
                    : <span style={{ color: 'var(--color-text-secondary)' }}>No interests recorded</span>
                  }
                </div>
              </div>
              <div>
                <span style={labelStyle}>Strengths and Weaknesses</span>
                <div style={{ ...valueStyle, lineHeight: 'var(--line-height-normal)' }}>
                  {student.strengths_weaknesses || <span style={{ color: 'var(--color-text-secondary)' }}>Not recorded</span>}
                </div>
              </div>
            </div>

            {actionError && <ErrorMessage message={actionError} />}

            <div style={buttonRowStyle}>
              <Button
                label="Edit Student"
                variant="secondary"
                onClick={() => { setIsEditing(true); setActionError(''); }}
                disabled={anyLoading}
              />
              <Button
                label="Generate Recommendations"
                variant="primary"
                onClick={handleGenerateRecommendations}
                loading={genLoading}
                disabled={anyLoading}
              />
              <Button
                label="Generate Action Plan"
                variant="secondary"
                onClick={handleGenerateActionPlan}
                loading={actionPlanLoading}
                disabled={anyLoading}
              />
            </div>

            {actionPlan && (
              <div style={actionPlanSectionStyle}>
                {actionPlanSuccess && <p style={successStyle}>{actionPlanSuccess}</p>}
                <h2 style={sectionHeadingStyle}>Action Plan</h2>
                <ActionPlanDisplay actionPlan={actionPlan} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StudentDetailPage;
