// REQ-089, REQ-090, REQ-091, REQ-100: Tabbed Student Profile Page
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import Tabs from '../../components/Tabs/Tabs';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getStudent, graduateStudent } from '../../api/students';
import { getAccount } from '../../api/account';
import { getSubjects } from '../../api/grades';
import { generatePlan } from '../../api/plan';
import client from '../../api/client';
import PersonalTab from './PersonalTab';
import GradesTab from './GradesTab';
import LanguageTab from './LanguageTab';
import EvaluationsTab from './EvaluationsTab';
import ActivitiesTab from './ActivitiesTab';
import NotesTab from './NotesTab';
import PlansTab from './PlansTab';

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'grades', label: 'Grades' },
  { id: 'language', label: 'Language' },
  { id: 'evaluations', label: 'Teacher Evaluations' },
  { id: 'activities', label: 'Activities' },
  { id: 'notes', label: 'Notes' },
  { id: 'plans', label: 'Plans' },
];

// Sonner-compatible showToast wrapper for hooks that still accept showToast(msg, type)
function showToast(message, type) {
  if (type === 'success') toast.success(message);
  else if (type === 'error') toast.error(message);
  else toast(message);
}

function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
      toast.success('Student marked as graduated. Data added to analytics.');
    } catch {
      toast.error('Failed to graduate student.');
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
      toast.error('Failed to start plan generation.');
      setGeneratingPlan(false);
    }
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-block', padding: 'var(--space-3) var(--space-8)' }}>
        {'\u2190'} Back to Dashboard
      </Link>

      {loading && <LoadingSpinner label="Loading student profile..." />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
          <Link to="/dashboard" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>Back to Dashboard</Link>
        </div>
      )}

      {!loading && !error && student && (
        <>
          <div style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4) var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                {student.full_name || 'Student Profile'}
              </h1>
              {student.year_of_study && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Year {student.year_of_study}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              {student.is_graduated && (
                <span style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-success)', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontWeight: 'var(--font-weight-medium)' }}>
                  Graduated {student.graduation_year || ''}
                </span>
              )}
              {!student.is_graduated && (
                <Button variant="secondary" onClick={handleOpenGraduate}>Mark as Graduated</Button>
              )}
              <Button variant="secondary" onClick={() => navigate(`/students/${id}/targets`)}>Target Schools</Button>
              <Button onClick={handleGeneratePlan} disabled={generatingPlan}>
                {generatingPlan ? 'Loading\u2026' : 'Generate Plan'}
              </Button>
            </div>
          </div>

          <div style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', position: 'sticky', top: '56px', zIndex: 50 }}>
            <Tabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange}>
              <div />
            </Tabs>
          </div>

          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 var(--space-8)' }}>
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

      <Dialog open={showGraduateModal} onOpenChange={setShowGraduateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Graduated</DialogTitle>
          </DialogHeader>
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
              <Input
                value={graduateForm.final_major}
                onChange={(e) => setGraduateForm((f) => ({ ...f, final_major: e.target.value }))}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>Graduation Year</label>
              <Input
                type="number"
                value={graduateForm.graduation_year}
                onChange={(e) => setGraduateForm((f) => ({ ...f, graduation_year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowGraduateModal(false)} disabled={graduateLoading}>Cancel</Button>
            <Button onClick={handleGraduate} disabled={graduateLoading}>
              {graduateLoading ? 'Saving\u2026' : 'Confirm Graduate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudentProfile;
