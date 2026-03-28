// REQ-032: Student Profile Management - Student list
import { useState, useEffect, useCallback } from 'react';
import NavBar from '../../components/NavBar/NavBar';
import StudentRow from '../../components/StudentRow/StudentRow';
import StudentForm from '../../components/StudentForm/StudentForm';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';
import { getStudents, createStudent } from '../../api/students';

function StudentListPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStudents();
      setStudents(data);
    } catch {
      setError('Could not load students. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCreateStudent = async (formData) => {
    setFormLoading(true);
    setFormError('');
    try {
      await createStudent(formData);
      setShowForm(false);
      await fetchStudents();
      setSuccessMessage('Student added successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch {
      setFormError('Could not save student. Please check your input and try again.');
    } finally {
      setFormLoading(false);
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

  const headerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 'var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    marginBottom: 'var(--space-6)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    background: 'var(--color-background)',
    fontWeight: 'var(--font-weight-medium)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const successStyle = {
    color: 'var(--color-success)',
    border: 'var(--border-width) solid var(--color-success)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--border-radius-sm)',
    marginBottom: 'var(--space-4)',
    fontSize: 'var(--font-size-sm)',
  };

  return (
    <div style={pageStyle}>
      <NavBar />
      <div style={contentStyle}>
        <div style={headerRowStyle}>
          <h1 style={headingStyle}>Students</h1>
          {!showForm && (
            <Button
              label="Add Student"
              variant="primary"
              onClick={() => setShowForm(true)}
            />
          )}
        </div>

        {successMessage && <p style={successStyle}>{successMessage}</p>}

        {showForm && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            {formError && <ErrorMessage message={formError} />}
            <StudentForm
              onSubmit={handleCreateStudent}
              onCancel={() => { setShowForm(false); setFormError(''); }}
              loading={formLoading}
              submitLabel="Save"
            />
          </div>
        )}

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Target Region</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <LoadingSpinner label="Loading students\u2026" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4}>
                  <ErrorMessage message={error} />
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState message="No students yet. Click Add Student to create a profile." />
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <StudentRow key={student.id} student={student} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudentListPage;
