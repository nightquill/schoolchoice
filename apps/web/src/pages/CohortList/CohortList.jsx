// REQ-093: Student Cohort List Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { Modal } from '@schoolchoice/ui';
import { getCohorts, createCohort, deleteCohort } from '../../api/cohorts';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

function CohortList() {
  const { t } = useTranslation();  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([getCohorts(), getAccount()])
      .then(([cohortsData, accountData]) => {
        setCohorts(cohortsData.cohorts ?? []);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || t('cohorts.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cohort = await createCohort({ name: newName.trim(), description: newDesc.trim() || null });
      setCohorts((prev) => [cohort, ...prev]);
      setCreateModalOpen(false);
      setNewName('');
      setNewDesc('');
      toast.success(t('cohorts.cohortCreated'));
    } catch {
      toast.error(t('cohorts.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCohort(deleteTarget.id);
      setCohorts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(t('cohorts.cohortDeleted'));
    } catch {
      toast.error(t('cohorts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const headerStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const containerStyle = {
    maxWidth: '100%',
    margin: '0 auto',
    padding: 'var(--space-6) var(--space-8)',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-md)',
    border: 'var(--border-width) solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
    padding: 'var(--space-4) var(--space-5)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    cursor: 'pointer',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 'var(--space-3)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      {loading && <LoadingSpinner label={t('cohorts.loading')} />}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && (
        <>
          <div style={headerStyle}>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              {t('cohorts.title')}
            </h1>
            <Button onClick={() => setCreateModalOpen(true)}>{t('cohorts.newCohort')}</Button>
          </div>

          <div style={containerStyle}>
            {cohorts.length === 0 ? (
              <EmptyState message={t('cohorts.emptyState')} />
            ) : (
              cohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  style={cardStyle}
                  onClick={() => navigate(`/cohorts/${cohort.id}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open cohort ${cohort.name}`}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/cohorts/${cohort.id}`)}
                >
                  <div>
                    <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                      {cohort.is_default ? t('dashboard.allStudentsCohort') : cohort.name}
                    </div>
                    {cohort.description && !cohort.is_default && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                        {cohort.description}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                      {t('cohorts.studentCount', { count: cohort.member_count })}
                    </div>
                  </div>
                  {!cohort.is_default && (
                    <button
                      style={{
                        background: 'none',
                        border: 'var(--border-width) solid var(--color-error)',
                        borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--color-error)',
                        fontSize: 'var(--font-size-sm)',
                        padding: 'var(--space-1) var(--space-3)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-base)',
                        flexShrink: 0,
                      }}
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(cohort); }}
                      aria-label={`Delete cohort ${cohort.name}`}
                    >
                      {t('cohorts.delete')}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Create cohort modal */}
      <Modal
        isOpen={createModalOpen}
        title={t('cohorts.newCohort')}
        onClose={() => { setCreateModalOpen(false); setNewName(''); setNewDesc(''); }}
        onConfirm={handleCreate}
        confirmLabel={creating ? t('cohorts.creating') : t('cohorts.create')}
        confirmVariant="primary"
      >
        <div>
          <label htmlFor="cohort-name-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            {t('cohorts.cohortName')} <span aria-hidden="true">*</span>
          </label>
          <input
            id="cohort-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("cohorts.cohortNamePlaceholder")}
            style={inputStyle}
          />
          <label htmlFor="cohort-desc-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            {t('cohorts.descriptionOptional')}
          </label>
          <input
            id="cohort-desc-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t("cohorts.descriptionPlaceholder")}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        title={t('cohorts.deleteCohort')}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? t('cohorts.deleting') : t('cohorts.delete')}
        confirmVariant="danger"
      >
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          {t('cohorts.deleteConfirm', { name: deleteTarget?.name })}
        </p>
      </Modal>

    </div>
  );
}

export default CohortList;
