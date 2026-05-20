// REQ: Onboarding wizard — 3-step flow: School Info → Create Teachers → Summary
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

function StepIndicator({ currentStep, steps }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      {steps.map((step) => {
        const isActive = step.number === currentStep;
        const isComplete = step.number < currentStep;
        return (
          <div key={step.number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-sm)',
                background: isActive
                  ? 'var(--color-primary)'
                  : isComplete
                    ? 'var(--color-primary)'
                    : 'var(--color-border)',
                color: isActive || isComplete ? '#fff' : 'var(--color-text-secondary)',
                opacity: isComplete ? 0.6 : 1,
                transition: 'background 0.2s, opacity 0.2s',
              }}
              aria-current={isActive ? 'step' : undefined}
            >
              {isComplete ? '\u2713' : step.number}
            </div>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const STEPS = [
    { number: 1, label: t('onboarding.schoolInfo') },
    { number: 2, label: t('onboarding.createTeachers') },
    { number: 3, label: t('onboarding.ready') },
  ];
  const [schoolName, setSchoolName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  // Teacher creation state
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [teachers, setTeachers] = useState([]);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data ?? null;

  const cardStyle = {
    maxWidth: 640,
    margin: '0 auto',
    marginTop: 'var(--space-8)',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-8)',
    boxShadow: 'var(--shadow-sm)',
  };

  const titleStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    marginBottom: 'var(--space-3)',
    textAlign: 'center',
  };

  const descStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-secondary)',
    margin: 0,
    marginBottom: 'var(--space-6)',
    textAlign: 'center',
    lineHeight: 1.6,
  };

  const buttonRowStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-6)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-1)',
  };

  const handleFinish = () => {
    localStorage.setItem('onboarding_complete', 'true');
    toast.success(t('onboarding.onboardingComplete'));
    navigate('/dashboard');
  };

  const handleSetupOrg = async () => {
    if (!schoolName.trim()) return;
    setSetupLoading(true);
    try {
      const { default: client } = await import('@schoolchoice/ui/api/client');
      await client.post('/api/v1/account/setup-organisation', {
        school_name: schoolName.trim(),
        email_domain: emailDomain.trim() || undefined,
      });
      setStep(2);
    } catch {
      toast.error(t('onboarding.orgCreateFailed'));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!teacherName.trim() || !teacherEmail.trim()) return;
    setAddingTeacher(true);
    try {
      const { default: client } = await import('@schoolchoice/ui/api/client');
      const res = await client.post('/api/v1/admin/users/create-teacher', {
        display_name: teacherName.trim(),
        email: teacherEmail.trim(),
        password: 'changeme123',
      });
      setTeachers((prev) => [...prev, { id: res.data.id, display_name: res.data.display_name, email: res.data.email }]);
      setTeacherName('');
      setTeacherEmail('');
      toast.success(t('onboarding.teacherAdded'));
    } catch {
      toast.error(t('onboarding.teacherAddFailed'));
    } finally {
      setAddingTeacher(false);
    }
  };

  const removeTeacher = (id) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <div style={cardStyle}>
          <StepIndicator currentStep={step} steps={STEPS} />

          {/* Step 1: School Info + Email Domain */}
          {step === 1 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.schoolInformation')}</h1>
              <p style={descStyle}>
                {t('onboarding.enterSchoolName')}
              </p>
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <label htmlFor="school-name" style={labelStyle}>
                  {t('onboarding.schoolName')}
                </label>
                <Input
                  id="school-name"
                  placeholder={t('onboarding.schoolNamePlaceholder')}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  autoFocus
                />
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <label htmlFor="email-domain" style={labelStyle}>
                    {t('onboarding.emailDomain')}
                  </label>
                  <Input
                    id="email-domain"
                    placeholder={t('onboarding.emailDomainPlaceholder')}
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                  />
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                    {t('onboarding.emailDomainDesc')}
                  </p>
                </div>
              </div>
              <div style={buttonRowStyle}>
                <Button
                  onClick={handleSetupOrg}
                  disabled={!schoolName.trim() || setupLoading}
                >
                  {setupLoading ? t('common.loading') : t('onboarding.next')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Create Teachers */}
          {step === 2 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.createTeachers')}</h1>
              <p style={descStyle}>
                {t('onboarding.createTeachersDesc')}
              </p>
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexDirection: 'column' }}>
                  <div>
                    <label htmlFor="teacher-name" style={labelStyle}>{t('onboarding.teacherName')}</label>
                    <Input
                      id="teacher-name"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder={t('onboarding.teacherName')}
                    />
                  </div>
                  <div>
                    <label htmlFor="teacher-email" style={labelStyle}>{t('onboarding.teacherEmail')}</label>
                    <Input
                      id="teacher-email"
                      type="email"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder={t('onboarding.teacherEmail')}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleAddTeacher}
                    disabled={addingTeacher || !teacherName.trim() || !teacherEmail.trim()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {addingTeacher ? t('common.loading') : t('onboarding.addTeacher')}
                  </Button>
                </div>

                {/* Teacher list */}
                {teachers.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    {teachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--space-2) var(--space-3)',
                          border: 'var(--border-width) solid var(--color-border)',
                          borderRadius: 'var(--border-radius-sm)',
                          marginBottom: 'var(--space-2)',
                          background: 'var(--color-background)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>{teacher.display_name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{teacher.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTeacher(teacher.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {t('onboarding.removeTeacher')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={buttonRowStyle}>
                <Button variant="outline" onClick={() => setStep(1)}>{t('onboarding.back')}</Button>
                <Button variant="secondary" onClick={() => setStep(3)}>{t('onboarding.skipTeachers')}</Button>
                {teachers.length > 0 && (
                  <Button onClick={() => setStep(3)}>{t('onboarding.next')}</Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Summary + Go to Dashboard */}
          {step === 3 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.allSet')}</h1>
              <p style={descStyle}>
                {t('onboarding.readyDesc')}
              </p>
              <div style={buttonRowStyle}>
                <Button onClick={handleFinish}>{t('onboarding.goToDashboard')}</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Onboarding;
