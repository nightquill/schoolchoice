import { useNavigate } from 'react-router-dom';
import { usePlansTab } from '../../hooks/usePlansTab';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';

export default function PlansTab({ studentId, showToast }) {
  const navigate = useNavigate();
  const {
    plans,
    loading,
    selected,
    deleting,
    handleDelete,
    selectPlan,
    clearSelected,
  } = usePlansTab(studentId, showToast);

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-4)',
    marginBottom: 'var(--space-3)',
    cursor: 'pointer',
  };

  const iframeStyle = {
    width: '100%',
    minHeight: '600px',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    background: '#fff',
    marginTop: 'var(--space-4)',
  };

  if (loading) return <LoadingSpinner label="Loading plan history..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
          Saved Plans ({plans.length})
        </h2>
        <Button label="Generate New Plan" variant="primary" onClick={() => navigate(`/students/${studentId}/plan`)} />
      </div>

      {plans.length === 0 && (
        <EmptyState message="No plans saved yet. Click 'Generate New Plan' to create one." />
      )}

      {selected && (
        <div>
          <button
            onClick={clearSelected}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-family-base)' }}
          >
            {'\u2190'} Back to plan list
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', margin: 0 }}>{selected.plan_label}</h3>
            <button
              onClick={(e) => handleDelete(e, selected.id)}
              disabled={deleting === selected.id}
              style={{ color: 'var(--color-error)', background: 'none', border: 'var(--border-width) solid var(--color-error)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', padding: 'var(--space-1) var(--space-3)' }}
            >
              {deleting === selected.id ? 'Deleting...' : 'Delete Plan'}
            </button>
          </div>
          {selected.snapshot_data && (
            <div style={{ background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <strong>Snapshot at generation time:</strong> {(selected.snapshot_data.subject_grades || []).length} subjects {'\u00B7'} Best-5 aggregate: {selected.snapshot_data.best5_aggregate ?? 'N/A'}
              {selected.recommended_schools?.length > 0 && ` \u00B7 ${selected.recommended_schools.length} recommended schools`}
            </div>
          )}
          {selected.html_content ? (
            <iframe
              style={iframeStyle}
              srcDoc={selected.html_content}
              title={selected.plan_label}
              sandbox="allow-same-origin"
            />
          ) : (
            <EmptyState message="Plan content was not stored for this entry." />
          )}
        </div>
      )}

      {!selected && plans.map((plan) => (
        <div
          key={plan.id}
          style={cardStyle}
          onClick={() => selectPlan(plan)}
          role="button"
          tabIndex={0}
          aria-label={`View ${plan.plan_label}`}
          onKeyDown={(e) => e.key === 'Enter' && selectPlan(plan)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {plan.plan_label || `Plan v${plan.version}`}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {plan.generated_at ? plan.generated_at.slice(0, 16).replace('T', ' ') : 'Date unknown'}
              </div>
              {plan.snapshot_data && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {(plan.snapshot_data.subject_grades || []).length} subjects {'\u00B7'} Best-5: {plan.snapshot_data.best5_aggregate ?? '?'}
                  {plan.recommended_schools?.length > 0 && ` \u00B7 ${plan.recommended_schools.length} recommended`}
                </div>
              )}
            </div>
            <button
              onClick={(e) => handleDelete(e, plan.id)}
              disabled={deleting === plan.id}
              style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-base)', padding: 'var(--space-1)' }}
            >
              {deleting === plan.id ? '\u2026' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
