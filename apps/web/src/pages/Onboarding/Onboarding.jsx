// REQ: Onboarding wizard — first-login detection + multi-step flow (Decision #9)
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
    { number: 1, label: t('onboarding.welcome') },
    { number: 2, label: t('onboarding.schoolInfo') },
    { number: 3, label: t('onboarding.import') },
    { number: 4, label: t('onboarding.ready') },
  ];
  const [schoolName, setSchoolName] = useState('');

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

  const handleFinish = () => {
    localStorage.setItem('onboarding_complete', 'true');
    toast.success(t('onboarding.onboardingComplete'));
    navigate('/dashboard');
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <div style={cardStyle}>
          <StepIndicator currentStep={step} steps={STEPS} />

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.welcomeTitle')}</h1>
              <p style={descStyle}>
                {t('onboarding.welcomeDesc')}
              </p>
              <div style={buttonRowStyle}>
                <Button onClick={() => setStep(2)}>{t('onboarding.getStarted')}</Button>
              </div>
            </div>
          )}

          {/* Step 2: School Info */}
          {step === 2 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.schoolInformation')}</h1>
              <p style={descStyle}>
                {t('onboarding.enterSchoolName')}
              </p>
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <label
                  htmlFor="school-name"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {t('onboarding.schoolName')}
                </label>
                <Input
                  id="school-name"
                  placeholder={t("onboarding.schoolNamePlaceholder")}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={buttonRowStyle}>
                <Button variant="outline" onClick={() => setStep(1)}>{t('onboarding.back')}</Button>
                <Button onClick={() => setStep(3)} disabled={!schoolName.trim()}>{t('onboarding.next')}</Button>
              </div>
            </div>
          )}

          {/* Step 3: Import Students */}
          {step === 3 && (
            <div>
              <h1 style={titleStyle}>{t('onboarding.importStudents')}</h1>
              <p style={descStyle}>
                {t('onboarding.importDesc')}
              </p>
              <div style={buttonRowStyle}>
                <Button variant="outline" onClick={() => setStep(2)}>{t('onboarding.back')}</Button>
                <Button variant="secondary" onClick={() => setStep(4)}>{t('onboarding.skipForNow')}</Button>
                <Button onClick={() => navigate('/entities/student/import')}>{t('onboarding.importStudents')}</Button>
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
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
