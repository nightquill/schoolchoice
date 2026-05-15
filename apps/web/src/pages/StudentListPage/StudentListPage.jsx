// REQ-032: Student Profile Management - Student list with search, import/export
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavBar, ActionBar, EmptyState, LoadingSpinner, ErrorMessage } from '@schoolchoice/ui';
import { Input } from '@schoolchoice/ui/primitives/input';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import StudentRow from '../../components/StudentRow/StudentRow';
import StudentForm from '../../components/StudentForm/StudentForm';
import { getStudents, createStudent } from '../../api/students';
import { exportEntityCSV } from '../../api/entities';

function StudentListPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(handle);
  }, [searchText]);

  const studentsQuery = useQuery({
    queryKey: ['students', debouncedSearch],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      return getStudents(params);
    },
  });

  const students = Array.isArray(studentsQuery.data)
    ? studentsQuery.data
    : (studentsQuery.data?.items ?? []);

  const handleCreateStudent = async (formData) => {
    setFormLoading(true);
    setFormError('');
    try {
      await createStudent(formData);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully.');
    } catch {
      setFormError('Could not save student. Please check your input and try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleExportFiltered = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      await exportEntityCSV('student', params);
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportEntityCSV('student', {});
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
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

  const searchBarStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    marginBottom: 'var(--space-4)',
    flexWrap: 'wrap',
  };

  const searchWrapStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
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

  return (
    <div style={pageStyle}>
      <NavBar />
      <div className="px-4 md:px-8" style={{ maxWidth: '100%', margin: '0 auto', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div style={headerRowStyle}>
          <h1 style={headingStyle}>Students</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>Add Student</Button>
          )}
        </div>

        <ActionBar
          entityName="student"
          onExportFiltered={handleExportFiltered}
          onExportAll={handleExportAll}
          isExporting={isExporting}
        />

        <div style={searchBarStyle}>
          <div style={searchWrapStyle}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none', zIndex: 1 }}>
              <Search size={16} />
            </span>
            <Input
              type="text"
              role="searchbox"
              aria-label="Search students"
              placeholder="Search students by name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 320, minHeight: 44, paddingLeft: 34 }}
            />
          </div>
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
                padding: 'var(--space-1) var(--space-2)',
                fontFamily: 'var(--font-family-base)',
                textDecoration: 'underline',
              }}
            >
              Clear search
            </button>
          )}
        </div>

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

        <div className="overflow-x-auto">
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
              {studentsQuery.isLoading ? (
                <tr>
                  <td colSpan={4}>
                    <LoadingSpinner label="Loading students..." />
                  </td>
                </tr>
              ) : studentsQuery.isError ? (
                <tr>
                  <td colSpan={4}>
                    <ErrorMessage message="Could not load students. Please refresh the page." />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      message={
                        debouncedSearch
                          ? 'No students match your search. Try a different name.'
                          : 'No students yet. Click Add Student to create a profile.'
                      }
                    />
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
    </div>
  );
}

export default StudentListPage;
