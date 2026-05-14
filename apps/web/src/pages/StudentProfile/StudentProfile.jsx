// REQ-089, REQ-090, REQ-091, REQ-100: Tabbed Student Profile Page
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@schoolchoice/ui/primitives/tabs';
import { QueryBoundary } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@schoolchoice/ui/primitives/dialog';
import { Input } from '@schoolchoice/ui/primitives/input';
import { getStudent, graduateStudent } from '../../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getSubjects } from '../../api/grades';
import PersonalTab from './PersonalTab';
import GradesTab from './GradesTab';
import LanguageTab from './LanguageTab';
import EvaluationsTab from './EvaluationsTab';
import ActivitiesTab from './ActivitiesTab';
import NotesTab from './NotesTab';
import PlansTab from './PlansTab';

function StudentProfile() {
  const { t } = useTranslation();

  const TABS = [
    { id: 'personal', label: t('profile.tabs.personal') },
    { id: 'grades', label: t('profile.tabs.grades') },
    { id: 'language', label: t('profile.tabs.language') },
    { id: 'evaluations', label: t('profile.tabs.evaluations') },
    { id: 'activities', label: t('profile.tabs.activities') },
    { id: 'notes', label: t('profile.tabs.notes') },
    { id: 'plans', label: t('profile.tabs.plans') },
  ];

  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [graduateForm, setGraduateForm] = useState({ final_school_id: '', final_major: '', graduation_year: new Date().getFullYear() });
  const [schoolOptions, setSchoolOptions] = useState([]);

  const activeTab = searchParams.get('tab') || 'personal';

  // Student data via useQuery (D-01: parent-fetches-all pattern)
  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
  });

  const accountQuery = useQuery({
    queryKey: ['account'],
    queryFn: getAccount,
    staleTime: 5 * 60 * 1000,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: getSubjects,
    staleTime: 10 * 60 * 1000,
  });

  const student = studentQuery.data;
  const account = accountQuery.data;
  const subjects = subjectsQuery.data ?? [];

  // Graduation mutation
  const graduateMutation = useMutation({
    mutationFn: (payload) => graduateStudent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setShowGraduateModal(false);
      toast.success(t('profile.graduateSuccess'));
    },
    onError: () => {
      toast.error(t('profile.graduateFailed'));
    },
  });

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleStudentSaved = (updated) => {
    // Optimistically update the query cache with the returned data
    queryClient.setQueryData(['student', id], updated);
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

  const handleGraduate = () => {
    graduateMutation.mutate({
      final_school_id: graduateForm.final_school_id || null,
      final_major: graduateForm.final_major || null,
      graduation_year: graduateForm.graduation_year ? parseInt(graduateForm.graduation_year, 10) : null,
    });
  };

  const handleGeneratePlan = () => {
    navigate(`/students/${id}/consultant?generate=true`);
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)', overflowX: 'hidden' }}>
      <NavBarV2 account={account} />
      <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-block', padding: 'var(--space-3) var(--space-8)' }}>
        {'\u2190'} {t('profile.backToDashboard')}
      </Link>

      <QueryBoundary
        isLoading={studentQuery.isLoading}
        isError={studentQuery.isError}
        error={studentQuery.error}
        refetch={studentQuery.refetch}
        resourceName="student"
      >
        {student && (
          <>
            <div className="px-4 md:px-8" style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
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
                    {t('profile.graduated')} {student.graduation_year || ''}
                  </span>
                )}
                {!student.is_graduated && (
                  <Button variant="secondary" onClick={handleOpenGraduate}>{t('profile.markGraduated')}</Button>
                )}
                <Button variant="secondary" onClick={() => navigate(`/students/${id}/targets`)}>{t('profile.targetSchools')}</Button>
                <Button onClick={handleGeneratePlan}>{t('profile.generatePlan')}</Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} style={{ flexDirection: 'column' }}>
              <div className="overflow-x-auto whitespace-nowrap" style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', position: 'sticky', top: '56px', zIndex: 50 }}>
                <TabsList variant="line" className="w-full justify-start" aria-label="Student profile sections">
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="px-4 md:px-8" style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: 'var(--space-4)' }}>
                <TabsContent value="personal">
                  <PersonalTab studentId={id} student={student} onSaved={handleStudentSaved} />
                </TabsContent>
                <TabsContent value="grades">
                  <GradesTab studentId={id} subjects={subjects} />
                </TabsContent>
                <TabsContent value="language">
                  <LanguageTab studentId={id} student={student} onSaved={handleStudentSaved} />
                </TabsContent>
                <TabsContent value="evaluations">
                  <EvaluationsTab studentId={id} />
                </TabsContent>
                <TabsContent value="activities">
                  <ActivitiesTab studentId={id} student={student} />
                </TabsContent>
                <TabsContent value="notes">
                  <NotesTab studentId={id} student={student} onSaved={handleStudentSaved} />
                </TabsContent>
                <TabsContent value="plans">
                  <PlansTab studentId={id} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </QueryBoundary>

      <Dialog open={showGraduateModal} onOpenChange={setShowGraduateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.markGraduated')}</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {t('profile.graduateConfirm')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('profile.finalSchool')}</label>
              <select
                value={graduateForm.final_school_id}
                onChange={(e) => setGraduateForm((f) => ({ ...f, final_school_id: e.target.value }))}
                style={{ width: '100%', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
              >
                <option value="">{t('profile.noneUnknown')}</option>
                {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('profile.finalMajor')}</label>
              <Input
                value={graduateForm.final_major}
                onChange={(e) => setGraduateForm((f) => ({ ...f, final_major: e.target.value }))}
                placeholder={t('profile.finalMajorPlaceholder')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{t('profile.graduationYear')}</label>
              <Input
                type="number"
                value={graduateForm.graduation_year}
                onChange={(e) => setGraduateForm((f) => ({ ...f, graduation_year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowGraduateModal(false)} disabled={graduateMutation.isPending}>{t('profile.cancel')}</Button>
            <Button onClick={handleGraduate} disabled={graduateMutation.isPending}>
              {graduateMutation.isPending ? t('profile.saving') : t('profile.confirmGraduate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudentProfile;
