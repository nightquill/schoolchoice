// Student Dashboard — grade sandbox on top, then programme choices, then submit
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import { toast } from 'sonner';
import ProgrammeChoicesTab from '../StudentProfile/ProgrammeChoicesTab';
import GradesTab from '../StudentProfile/GradesTab';
import { useTranslation } from '@schoolchoice/ui/i18n';

function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data;

  useEffect(() => {
    if (account && account.role !== 'student') {
      navigate('/dashboard', { replace: true });
    }
  }, [account, navigate]);

  // Load current submission status
  useEffect(() => {
    if (account?.student_id) {
      import('@schoolchoice/ui/api/client').then(({ default: client }) => {
        client.get('/api/v1/student/choices').then((r) => {
          const sub = r.data?.submission;
          setSubmissionStatus(sub?.status || null);
        }).catch(() => {});
      });
    }
  }, [account?.student_id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { default: client } = await import('@schoolchoice/ui/api/client');

      // First save current targets as choices
      const targetsResp = await client.get(`/api/v1/students/${account.student_id}/targets`);
      const targets = targetsResp.data?.targets ?? [];
      const choices = targets
        .filter(t => t.jupas_code)
        .sort((a, b) => (a.student_rank ?? 99) - (b.student_rank ?? 99))
        .map((t, i) => ({
          rank: t.student_rank || i + 1,
          jupas_code: t.jupas_code,
          programme_name: t.programme_name || '',
          school_name: t.school_name || '',
        }));

      if (choices.length === 0) {
        toast.error(t('studentDashboard.addProgrammeFirst'));
        return;
      }

      // Save as draft
      await client.put('/api/v1/student/choices', { choices });

      // Submit
      await client.post('/api/v1/student/choices/submit');
      setSubmissionStatus('pending');
      toast.success(t('studentDashboard.submitSuccess'));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 429) {
        toast.error(typeof detail === 'string' ? detail : t('studentDashboard.rateLimited'));
      } else {
        toast.error(typeof detail === 'string' ? detail : t('studentDashboard.submitFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (accountQuery.isLoading || !account) {
    return (
      <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
        <LoadingSpinner label={t('common.loading')} />
      </div>
    );
  }

  const studentId = account.student_id;
  if (!studentId) {
    return (
      <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
        <NavBarV2 account={account} />
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          {t('studentDashboard.noProfile')}
        </div>
      </div>
    );
  }

  const statusLabels = {
    pending: { text: t('submissionHistory.pendingReview'), bg: '#fef3c7', color: '#92400e' },
    approved: { text: t('submissionHistory.approved'), bg: '#dcfce7', color: '#166534' },
    revision_requested: { text: t('submissionHistory.revisionRequested'), bg: '#fee2e2', color: '#991b1b' },
    rejected: { text: t('submissionHistory.rejected'), bg: '#fee2e2', color: '#991b1b' },
    draft: { text: t('submissionHistory.draft'), bg: '#f1f5f9', color: '#475569' },
  };
  const statusInfo = submissionStatus ? statusLabels[submissionStatus] : null;

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        {/* Header with name + submit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              {account.display_name}
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-3)' }}>
                ID: {account.email?.replace('@student.local', '')}
              </span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {statusInfo && (
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600, background: statusInfo.bg, color: statusInfo.color }}>
                {statusInfo.text}
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || submissionStatus === 'pending'}
            >
              {submitting ? t('studentDashboard.submitting') : submissionStatus === 'pending' ? t('studentDashboard.awaitingReview') : t('studentDashboard.submitToTeacher')}
            </Button>
          </div>
        </div>

        {/* Grades — tabbed: Actual Grades + grade sets */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
            {t('studentPortal.myGrades')}
          </h2>
          <GradesTab studentId={studentId} isStudentView={true} />
        </div>

        {/* Programme Choices */}
        <ProgrammeChoicesTab studentId={studentId} isStudent={true} />
      </div>
    </div>
  );
}

export default StudentDashboard;
