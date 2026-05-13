import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getAlerts } from '../../api/alerts';

const SEVERITY_CONFIG = {
  error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', Icon: AlertCircle },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', Icon: AlertTriangle },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', Icon: Info },
};

const CATEGORIES = [
  {
    id: 'missing',
    label: 'Missing / Incomplete',
    types: ['missing_grades', 'missing_targets', 'stale_data'],
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    Icon: AlertTriangle,
  },
  {
    id: 'conservative',
    label: 'Too Conservative',
    types: ['dubious_conservative'],
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    Icon: Info,
  },
  {
    id: 'ambitious',
    label: 'Too Ambitious',
    types: ['dubious_ambitious', 'at_risk_target'],
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    Icon: AlertCircle,
  },
];

function AlertsPanel() {
  const [dismissed, setDismissed] = useState(new Set());
  const [expandedTab, setExpandedTab] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    staleTime: 60000,
  });

  if (isLoading || !data) return null;

  const allAlerts = (data.alerts || []).filter(
    (a) => !dismissed.has(`${a.type}-${a.student_id}`)
  );

  if (allAlerts.length === 0) return null;

  const handleDismiss = (alert) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${alert.type}-${alert.student_id}`);
      return next;
    });
  };

  // Group alerts strictly by category
  const grouped = {};
  for (const cat of CATEGORIES) {
    grouped[cat.id] = allAlerts.filter((a) => cat.types.includes(a.type));
  }

  return (
    <div style={{ padding: 'var(--space-3) var(--space-4)' }} role="region" aria-label="Alerts">
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        margin: '0 0 var(--space-2) 0',
      }}>
        Alerts
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {CATEGORIES.map((cat) => {
          const alerts = grouped[cat.id] || [];
          const count = alerts.length;
          const isExpanded = expandedTab === cat.id;
          const CatIcon = cat.Icon;

          return (
            <div key={cat.id} style={{ border: `1px solid ${cat.border}`, borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              {/* Category header — always visible, shows count */}
              <button
                onClick={() => setExpandedTab(isExpanded ? null : cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  width: '100%', padding: 'var(--space-2) var(--space-3)',
                  background: count > 0 ? cat.bg : 'var(--color-background)',
                  border: 'none', cursor: 'pointer',
                  color: count > 0 ? cat.color : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)',
                  fontWeight: 'var(--font-weight-medium)', textAlign: 'left',
                }}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <CatIcon size={14} />
                <span style={{ flex: 1 }}>{cat.label}</span>
                <span style={{
                  background: count > 0 ? cat.color : 'var(--color-border)',
                  color: '#fff',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '1px 8px', borderRadius: '999px',
                  minWidth: '24px', textAlign: 'center',
                }}>
                  {count}
                </span>
              </button>

              {/* Expanded alert list */}
              {isExpanded && count > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', borderTop: `1px solid ${cat.border}` }}>
                  {alerts.map((alert) => {
                    const key = `${alert.type}-${alert.student_id}`;
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)',
                          borderBottom: `1px solid ${cat.border}`,
                          fontSize: 'var(--font-size-xs)', color: cat.color,
                          background: 'var(--color-surface)',
                        }}
                        role="alert"
                      >
                        <span style={{ flex: 1 }}>{alert.message}</span>
                        <button
                          onClick={() => handleDismiss(alert)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 1, color: cat.color, opacity: 0.5, flexShrink: 0,
                          }}
                          aria-label="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && count === 0 && (
                <div style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                  borderTop: `1px solid ${cat.border}`,
                }}>
                  No alerts in this category.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AlertsPanel;
