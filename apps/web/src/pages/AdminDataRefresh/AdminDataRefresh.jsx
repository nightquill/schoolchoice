// REQ-098: Admin Data Refresh Page (admin role guard enforced)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { toast } from 'sonner';
import { Modal } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import client from '@schoolchoice/ui/api/client';

function AdminDataRefresh() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [_lastRefreshBy, setLastRefreshBy] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sourceStatuses, setSourceStatuses] = useState({
    subjects: null,
    schools: null,
    jupas: null,
  });

  useEffect(() => {
    getAccount()
      .then((data) => {
        setAccount(data);
        if (data.role !== 'admin') {
          toast.error('You do not have permission to access that page.');
          navigate('/dashboard');
        }
      })
      .catch(() => navigate('/dashboard'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTriggerRefresh = async () => {
    setTriggering(true);
    try {
      const response = await client.post('/api/v1/admin/data-refresh').then((r) => r.data);
      setTriggered(true);
      setConfirmModalOpen(false);
      const triggeredAt = response.triggered_at || new Date().toISOString();
      const triggeredBy = response.triggered_by || account?.email || 'Admin';
      setLastRefreshAt(triggeredAt);
      setLastRefreshBy(triggeredBy);
      setSourceStatuses({ subjects: 'pending', schools: 'pending', jupas: 'pending' });
      setMessages((prev) => [...prev, `[${triggeredAt.slice(0, 19).replace('T', ' ')}] Triggered by ${triggeredBy}`]);
      toast.success('Data refresh triggered.');
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error('You do not have permission to trigger a data refresh.');
      } else {
        toast.error('Failed to trigger data refresh.');
      }
    } finally {
      setTriggering(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '760px',
    margin: '0 auto',
    padding: 'var(--space-10) var(--space-8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  };

  const pageHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const adminBadgeStyle = {
    display: 'inline-block',
    background: 'var(--color-warning)',
    color: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-sm)',
    padding: '2px var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    verticalAlign: 'middle',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
  };

  const cardTitleStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-4)',
  };

  const statusRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-2) 0',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    fontSize: 'var(--font-size-sm)',
  };

  const getStatusIcon = (status) => {
    if (!status) return { icon: '\u2014', color: 'var(--color-text-secondary)' };
    if (status === 'pending' || status === 'running') return { icon: '…', color: 'var(--color-warning)' };
    if (status === 'success' || status === 'complete') return { icon: '\u2713', color: 'var(--color-success)' };
    return { icon: '\u2014', color: 'var(--color-text-secondary)' };
  };

  const consoleStyle = {
    height: '200px',
    overflowY: 'auto',
    background: 'var(--color-background)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-3)',
    fontFamily: 'monospace, var(--font-family-base)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'pre-wrap',
  };

  const sources = [
    { key: 'subjects', label: 'Subjects (HKEAA data)' },
    { key: 'schools', label: 'Schools (University profiles)' },
    { key: 'jupas', label: 'JUPAS Scores' },
  ];

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <main id="main-content" style={contentStyle}>
        <div style={pageHeaderStyle}>
          <h1 style={headingStyle}>Data Refresh</h1>
          <span style={adminBadgeStyle}>Admin</span>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Refresh Status</h2>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Last Refresh: </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: lastRefreshAt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {lastRefreshAt ? lastRefreshAt.slice(0, 19).replace('T', ' ') : 'Never'}
            </span>
          </div>
          {sources.map(({ key, label }) => {
            const { icon, color } = getStatusIcon(sourceStatuses[key]);
            return (
              <div key={key} style={statusRowStyle}>
                <span>{label}</span>
                <span style={{ color, fontWeight: 'var(--font-weight-medium)' }}>{icon}</span>
              </div>
            );
          })}
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Trigger Data Refresh</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 'var(--line-height-normal)' }}>
            Running a data refresh will update school profiles, JUPAS entry scores, and subject lists from external sources. This may take several minutes.
          </p>
          <Button disabled={triggered} onClick={() => setConfirmModalOpen(true)}>
            {triggered ? 'Refresh Triggered' : 'Trigger Data Refresh'}
          </Button>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Recent Messages</h2>
          <div style={consoleStyle} aria-label="Refresh log messages" role="log" aria-live="polite">
            {messages.length === 0
              ? 'No refresh messages yet.'
              : messages.join('\n')}
          </div>
        </div>
      </main>

      <Modal
        isOpen={confirmModalOpen}
        title="Confirm Data Refresh"
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleTriggerRefresh}
        confirmLabel={triggering ? 'Triggering…' : 'Yes, Trigger Refresh'}
        confirmVariant="primary"
      >
        <p>This will queue a full data re-import. Continue?</p>
      </Modal>

    </div>
  );
}

export default AdminDataRefresh;
