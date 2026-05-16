// REQ-098: Admin Data Refresh Page (admin role guard enforced)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { toast } from 'sonner';
import { Modal } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

function AdminDataRefresh() {
  const { t } = useTranslation();
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

  // Diff preview state
  const [csvFile, setCsvFile] = useState(null);
  const [entityType, setEntityType] = useState('schools');
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  useEffect(() => {
    getAccount()
      .then((data) => {
        setAccount(data);
        if (data.role !== 'admin') {
          toast.error(t('dataRefresh.noPermission'));
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
      setMessages((prev) => [...prev, `[${triggeredAt.slice(0, 19).replace('T', ' ')}] ${t('dataRefresh.triggeredBy')} ${triggeredBy}`]);
      toast.success(t('dataRefresh.triggerSuccess'));
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error(t('dataRefresh.triggerNoPermission'));
      } else {
        toast.error(t('dataRefresh.triggerFailed'));
      }
    } finally {
      setTriggering(false);
    }
  };

  const handlePreview = async () => {
    if (!csvFile) {
      toast.error(t('dataRefresh.selectCsvFirst'));
      return;
    }
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const response = await client.post(
        `/api/v1/admin/data-refresh/preview?entity_type=${entityType}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then((r) => r.data);
      setPreviewResult(response);
      toast.success(t('dataRefresh.previewSuccess'));
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error(t('dataRefresh.previewNoPermission'));
      } else {
        toast.error(t('dataRefresh.previewFailed'));
      }
    } finally {
      setPreviewing(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '100%',
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
    { key: 'subjects', label: t('dataRefresh.subjectsSource') },
    { key: 'schools', label: t('dataRefresh.schoolsSource') },
    { key: 'jupas', label: t('dataRefresh.jupasSource') },
  ];

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <main id="main-content" style={contentStyle}>
        <div style={pageHeaderStyle}>
          <h1 style={headingStyle}>{t('dataRefresh.title')}</h1>
          <span style={adminBadgeStyle}>{t('dataRefresh.admin')}</span>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>{t('dataRefresh.refreshStatus')}</h2>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.lastRefresh')} </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: lastRefreshAt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {lastRefreshAt ? lastRefreshAt.slice(0, 19).replace('T', ' ') : t('dataRefresh.never')}
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
          <h2 style={cardTitleStyle}>{t('dataRefresh.csvDiffPreview')}</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 'var(--line-height-normal)' }}>
            {t('dataRefresh.csvDiffDesc')}
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                {t('dataRefresh.entityType')}
              </label>
              <select
                value={entityType}
                onChange={(e) => { setEntityType(e.target.value); setPreviewResult(null); }}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'var(--border-width) solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="schools">{t('dataRefresh.schools')}</option>
                <option value="subjects">{t('dataRefresh.subjects')}</option>
              </select>
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                {t('dataRefresh.csvFile')}
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => { setCsvFile(e.target.files[0] || null); setPreviewResult(null); }}
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
            </div>
            <Button onClick={handlePreview} disabled={previewing || !csvFile}>
              {previewing ? t('dataRefresh.previewing') : t('dataRefresh.previewChanges')}
            </Button>
          </div>

          {previewResult && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius-sm)', background: '#dcfce7', color: '#166534', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  + {previewResult.added} {t('dataRefresh.added')}
                </div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius-sm)', background: '#fef3c7', color: '#92400e', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  ~ {previewResult.updated} {t('dataRefresh.updated')}
                </div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius-sm)', background: '#f3f4f6', color: '#6b7280', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  = {previewResult.unchanged} {t('dataRefresh.unchanged')}
                </div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('dataRefresh.totalRows')} {previewResult.total_rows}
                </div>
              </div>

              {previewResult.added_preview.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: '#166534', marginBottom: 'var(--space-2)' }}>
                    {t('dataRefresh.newRecords')}
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.key')}</th>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.fields')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.added_preview.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)', fontWeight: 'var(--font-weight-medium)' }}>{item.key}</td>
                            <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                              {Object.entries(item.fields).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewResult.updated_preview.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: '#92400e', marginBottom: 'var(--space-2)' }}>
                    {t('dataRefresh.updatedRecords')}
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.key')}</th>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.field')}</th>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.old')}</th>
                          <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{t('dataRefresh.new')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.updated_preview.map((item, i) =>
                          Object.entries(item.changes).map(([field, diff], j) => (
                            <tr key={`${i}-${j}`}>
                              {j === 0 && (
                                <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)', fontWeight: 'var(--font-weight-medium)', verticalAlign: 'top' }} rowSpan={Object.keys(item.changes).length}>
                                  {item.key}
                                </td>
                              )}
                              <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>{field}</td>
                              <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)', color: '#dc2626', textDecoration: 'line-through' }}>{diff.old}</td>
                              <td style={{ padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--color-border)', color: '#16a34a' }}>{diff.new}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button onClick={() => setConfirmModalOpen(true)}>
                {t('dataRefresh.publishChanges')}
              </Button>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>{t('dataRefresh.triggerTitle')}</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 'var(--line-height-normal)' }}>
            {t('dataRefresh.triggerDesc')}
          </p>
          <Button disabled={triggered} onClick={() => setConfirmModalOpen(true)}>
            {triggered ? t('dataRefresh.refreshTriggered') : t('dataRefresh.triggerRefresh')}
          </Button>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>{t('dataRefresh.recentMessages')}</h2>
          <div style={consoleStyle} aria-label={t('dataRefresh.refreshLog')} role="log" aria-live="polite">
            {messages.length === 0
              ? t('dataRefresh.noMessages')
              : messages.join('\n')}
          </div>
        </div>
      </main>

      <Modal
        isOpen={confirmModalOpen}
        title={t('dataRefresh.confirmTitle')}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleTriggerRefresh}
        confirmLabel={triggering ? t('dataRefresh.triggering') : t('dataRefresh.confirmButton')}
        confirmVariant="primary"
      >
        <p>{t('dataRefresh.confirmDesc')}</p>
      </Modal>

    </div>
  );
}

export default AdminDataRefresh;
