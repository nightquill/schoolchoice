import { useNavigate } from 'react-router-dom';
import { usePlansTab } from '../../hooks/usePlansTab';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';

export default function PlansTab({ studentId }) {
  const navigate = useNavigate();
  const {
    plans,
    loading,
    selected,
    setSelected,
    deleting,
    handleDelete,
  } = usePlansTab(studentId);

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

  if (loading) return <LoadingSpinner label="Loading plan history…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
          Saved Plans ({plans.length})
        </h2>
        <Button onClick={() => navigate(`/students/${studentId}/consultant?generate=true`)}>Generate New Plan</Button>
      </div>

      {plans.length === 0 && (
        <EmptyState message="No plans saved yet. Click 'Generate New Plan' to create one." />
      )}

      {selected && (
        <div>
          <button
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-family-base)' }}
          >
            {'\u2190'} Back to plan list
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', margin: 0 }}>{selected.plan_label}</h3>
            <Button
              variant="destructive"
              onClick={(e) => handleDelete(e, selected.id)}
              disabled={deleting === selected.id}
            >
              {deleting === selected.id ? 'Deleting…' : 'Delete Plan'}
            </Button>
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
              sandbox=""
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
          onClick={() => setSelected(plan)}
          role="button"
          tabIndex={0}
          aria-label={`View ${plan.plan_label}`}
          onKeyDown={(e) => e.key === 'Enter' && setSelected(plan)}
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
              {deleting === plan.id ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
