import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { getAlerts } from '../../api/alerts';

const SEVERITY_CONFIG = {
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#991b1b',
    Icon: AlertCircle,
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#92400e',
    Icon: AlertTriangle,
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1e40af',
    Icon: Info,
  },
};

function AlertsPanel() {
  const [dismissed, setDismissed] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    staleTime: 60000,
  });

  if (isLoading || !data) return null;

  const visibleAlerts = (data.alerts || []).filter(
    (a) => !dismissed.has(`${a.type}-${a.student_id}`)
  );

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (alert) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${alert.type}-${alert.student_id}`);
      return next;
    });
  };

  return (
    <div
      style={{
        padding: 'var(--space-4) var(--space-4)',
      }}
      role="region"
      aria-label="Alerts"
    >
      <h2
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          margin: '0 0 var(--space-3) 0',
        }}
      >
        Alerts ({visibleAlerts.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {visibleAlerts.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
          const { Icon } = config;
          const key = `${alert.type}-${alert.student_id}`;

          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: config.bg,
                border: `1px solid ${config.border}`,
                borderRadius: 'var(--border-radius-sm)',
                color: config.color,
              }}
              role="alert"
            >
              <Icon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>
                {alert.message}
              </span>
              <button
                onClick={() => handleDismiss(alert)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: config.color,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
                aria-label="Dismiss alert"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AlertsPanel;
