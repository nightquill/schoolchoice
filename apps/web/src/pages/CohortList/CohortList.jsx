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

function CohortList() {
  const navigate = useNavigate();
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
        setError(err?.response?.data?.detail || 'Failed to load cohorts.');
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
      toast.success('Cohort created.');
    } catch {
      toast.error('Failed to create cohort.');
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
      toast.success('Cohort deleted.');
    } catch {
      toast.error('Failed to delete cohort.');
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
    maxWidth: '960px',
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

      {loading && <LoadingSpinner label="Loading cohorts…" />}
      {error && <div style={{ padding: 'var(--space-6) var(--space-8)' }}><ErrorMessage message={error} /></div>}

      {!loading && !error && (
        <>
          <div style={headerStyle}>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Student Cohorts
            </h1>
            <Button onClick={() => setCreateModalOpen(true)}>New Cohort</Button>
          </div>

          <div style={containerStyle}>
            {cohorts.length === 0 ? (
              <EmptyState message="No cohorts yet. Create one to group students and view aggregate stats." />
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
                      {cohort.name}
                    </div>
                    {cohort.description && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                        {cohort.description}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                      {cohort.member_count} {cohort.member_count === 1 ? 'student' : 'students'}
                    </div>
                  </div>
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
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Create cohort modal */}
      <Modal
        isOpen={createModalOpen}
        title="New Cohort"
        onClose={() => { setCreateModalOpen(false); setNewName(''); setNewDesc(''); }}
        onConfirm={handleCreate}
        confirmLabel={creating ? 'Creating…' : 'Create'}
        confirmVariant="primary"
      >
        <div>
          <label htmlFor="cohort-name-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            Cohort Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="cohort-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. 5A 2025"
            style={inputStyle}
          />
          <label htmlFor="cohort-desc-input" style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            Description (optional)
          </label>
          <input
            id="cohort-desc-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description"
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        title="Delete Cohort"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
      >
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          Delete cohort <strong>{deleteTarget?.name}</strong>? This cannot be undone. Students are not affected.
        </p>
      </Modal>

    </div>
  );
}

export default CohortList;
