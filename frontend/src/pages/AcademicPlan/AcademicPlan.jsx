// REQ-096, REQ-099: Academic Plan Page — async plan generation with polling
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';
import Toast from '../../components/Toast/Toast';
import { useToast } from '../../hooks/useToast';
import { generatePlan, getPlanStatus, getPlan } from '../../api/plan';
import { getStudent } from '../../api/students';
import { getAccount } from '../../api/account';

const POLL_INTERVAL_MS = 2000;

function AcademicPlan() {
  const { id } = useParams();
  const { toasts, showToast, removeToast } = useToast();
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState(null); // null | 'pending' | 'running' | 'complete' | 'failed'
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  };

  const startPolling = () => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPlanStatus(id);
        const statusValue = (status.status || status).toUpperCase();
        setPlanStatus(statusValue);
        if (statusValue === 'DONE') {
          stopPolling();
          const planData = await getPlan(id);
          setPlan(planData);
          showToast('Plan ready \u2014 view it here.', 'success');
        } else if (statusValue === 'FAILED') {
          stopPolling();
          setError('Plan generation failed. Please try again.');
          showToast('Plan generation failed.', 'error');
        }
      } catch {
        stopPolling();
        setError('Failed to check plan status.');
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    Promise.all([
      getStudent(id),
      getAccount(),
      getPlanStatus(id).catch(() => null),
      getPlan(id).catch(() => null),
    ])
      .then(([studentData, accountData, statusData, planData]) => {
        setStudent(studentData);
        setAccount(accountData);
        if (planData?.html_content) {
          setPlan(planData);
          setPlanStatus('DONE');
        } else if (statusData) {
          const sv = (statusData.status || statusData).toUpperCase();
          setPlanStatus(sv);
          if (sv === 'PENDING' || sv === 'RUNNING') {
            startPolling();
          }
        }
      })
      .catch(() => {
        setError('Failed to load plan data.');
      })
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generatePlan(id);
      setPlanStatus('pending');
      setPlan(null);
      startPolling();
    } catch {
      showToast('Failed to start plan generation.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelPolling = () => {
    stopPolling();
    setPlanStatus(null);
  };

  const isGenerating = polling || planStatus === 'PENDING' || planStatus === 'RUNNING';

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
    display: 'flex',
    flexDirection: 'column',
  };

  const toolbarStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-3) var(--space-6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
    flexShrink: 0,
  };

  const toolbarLeftStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const studentNameStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const versionStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    margin: 0,
  };

  const toolbarRightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexShrink: 0,
  };

  const timestampStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const contentZoneStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const iframeStyle = {
    width: '100%',
    flex: 1,
    border: 'none',
    background: 'var(--color-background)',
    display: 'block',
    minHeight: 'calc(100vh - 120px)',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-2) var(--space-6)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    background: 'var(--color-surface)',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/students/${id}/profile`} style={backLinkStyle}>← Back to Profile</Link>

      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <p style={studentNameStyle}>{student?.full_name || 'Academic Plan'}</p>
          {plan?.version && (
            <p style={versionStyle}>Plan v{plan.version}</p>
          )}
        </div>
        <Button
          label="Generate Plan"
          variant="primary"
          onClick={handleGeneratePlan}
          loading={generating || isGenerating}
          disabled={isGenerating}
        />
        <div style={toolbarRightStyle}>
          {plan?.html_content && (
            <Button label="Print" variant="secondary" onClick={() => window.print()} />
          )}
          {plan?.generated_at && (
            <span style={timestampStyle}>
              Generated: {plan.generated_at.replace('T', ' ').slice(0, 16)}
            </span>
          )}
        </div>
      </div>

      {loading && <div style={contentZoneStyle}><LoadingSpinner label="Loading plan..." /></div>}

      {!loading && (
        <>
          {isGenerating && (
            <div style={{ ...contentZoneStyle, gap: 'var(--space-4)', padding: 'var(--space-8)' }}>
              <LoadingSpinner label="Generating plan..." />
              <div role="status" aria-live="polite">
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', textAlign: 'center', margin: '0 0 var(--space-2) 0' }}>
                  Generating plan…
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
                  This usually takes up to 10 seconds.
                </p>
              </div>
              <Button label="Cancel" variant="secondary" onClick={handleCancelPolling} />
            </div>
          )}

          {!isGenerating && error && (
            <div style={{ ...contentZoneStyle, padding: 'var(--space-8)' }}>
              <ErrorMessage message={error} />
              <Button label="Try Again" variant="primary" onClick={handleGeneratePlan} />
            </div>
          )}

          {!isGenerating && !error && plan?.html_content && (
            <iframe
              style={iframeStyle}
              srcDoc={plan.html_content}
              title={`Academic Plan for ${student?.full_name || 'student'}`}
              sandbox="allow-same-origin"
              aria-label="Academic plan document"
            />
          )}

          {!isGenerating && !error && !plan?.html_content && (
            <div style={contentZoneStyle}>
              <EmptyState message="No plan has been generated yet." />
              <Button label="Generate Plan" variant="primary" onClick={handleGeneratePlan} loading={generating} />
            </div>
          )}
        </>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default AcademicPlan;
