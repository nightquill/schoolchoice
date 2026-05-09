// REQ: Onboarding wizard — first-login detection + multi-step flow (Decision #9)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getAccount } from '@schoolchoice/ui/api/account';

const STEPS = [
  { number: 1, label: 'Welcome' },
  { number: 2, label: 'School Info' },
  { number: 3, label: 'Import' },
  { number: 4, label: 'Ready' },
];

function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      {STEPS.map((step) => {
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
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
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
    toast.success('Onboarding complete! Welcome aboard.');
    navigate('/dashboard');
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <div style={cardStyle}>
          <StepIndicator currentStep={step} />

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 style={titleStyle}>Welcome to Academic Advisor</h1>
              <p style={descStyle}>
                Let's get your account set up in just a few steps. We'll collect some basic
                information about your school and help you import your first students.
              </p>
              <div style={buttonRowStyle}>
                <Button onClick={() => setStep(2)}>Get Started</Button>
              </div>
            </div>
          )}

          {/* Step 2: School Info */}
          {step === 2 && (
            <div>
              <h1 style={titleStyle}>School Information</h1>
              <p style={descStyle}>
                Enter your school name so we can personalise your experience.
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
                  School Name
                </label>
                <Input
                  id="school-name"
                  placeholder="e.g. St. Paul's Co-educational College"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={buttonRowStyle}>
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!schoolName.trim()}>Next</Button>
              </div>
            </div>
          )}

          {/* Step 3: Import Students */}
          {step === 3 && (
            <div>
              <h1 style={titleStyle}>Import Students</h1>
              <p style={descStyle}>
                You can upload a CSV or Excel file to bulk-import your students.
                If you'd prefer to do this later, you can skip this step.
              </p>
              <div style={buttonRowStyle}>
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button variant="secondary" onClick={() => setStep(4)}>Skip for now</Button>
                <Button onClick={() => navigate('/entities/student/import')}>Import Students</Button>
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div>
              <h1 style={titleStyle}>You're All Set!</h1>
              <p style={descStyle}>
                Your account is ready. Head to the dashboard to start working with your students.
              </p>
              <div style={buttonRowStyle}>
                <Button onClick={handleFinish}>Go to Dashboard</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Onboarding;
