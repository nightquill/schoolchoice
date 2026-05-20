import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info, FileCheck, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getAlerts } from '../../api/alerts';
import { useTranslation } from '@schoolchoice/ui/i18n';

const SEVERITY_CONFIG = {
  error: { bg: 'var(--color-error-bg)', border: 'var(--color-error-border)', color: 'var(--color-error-text)', Icon: AlertCircle },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', color: 'var(--color-warning-text)', Icon: AlertTriangle },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info-border)', color: 'var(--color-info-text)', Icon: Info },
};

const CATEGORIES_CONFIG = [
  {
    id: 'pendingReview',
    labelKey: 'alerts.pendingReview',
    types: ['pending_review'],
    color: 'var(--color-primary)',
    bg: 'rgba(37,99,235,0.06)',
    border: 'rgba(37,99,235,0.2)',
    Icon: FileCheck,
  },
  {
    id: 'dataQuality',
    labelKey: 'alerts.studentDataQuality',
    types: ['missing_grades', 'missing_targets', 'stale_data', 'missing_plan'],
    color: 'var(--color-warning-text)',
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
    Icon: AlertTriangle,
  },
  {
    id: 'conservative',
    labelKey: 'alerts.conservative',
    types: ['dubious_conservative'],
    color: 'var(--color-info-text)',
    bg: 'var(--color-info-bg)',
    border: 'var(--color-info-border)',
    Icon: Info,
  },
  {
    id: 'ambitious',
    labelKey: 'alerts.ambitious',
    types: ['dubious_ambitious', 'at_risk_target'],
    color: 'var(--color-error-text)',
    bg: 'var(--color-error-bg)',
    border: 'var(--color-error-border)',
    Icon: AlertCircle,
  },
];

function AlertsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleDismiss = (e, alert) => {
    e.stopPropagation();
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${alert.type}-${alert.student_id}`);
      return next;
    });
  };

  const handleAlertClick = (alert) => {
    if (alert.type === 'pending_review' && alert.submission_id) {
      navigate(`/submissions/${alert.submission_id}`);
    } else if (alert.student_id) {
      navigate(`/students/${alert.student_id}/profile?tab=programmes`);
    }
  };

  // Group alerts strictly by category
  const CATEGORIES = CATEGORIES_CONFIG.map(cat => ({ ...cat, label: t(cat.labelKey) }));
  const grouped = {};
  for (const cat of CATEGORIES) {
    grouped[cat.id] = allAlerts.filter((a) => cat.types.includes(a.type));
  }

  return (
    <div className="px-4 md:px-8" style={{ paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)' }} role="region" aria-label="Alerts">
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        margin: '0 0 var(--space-2) 0',
      }}>
        {t('alerts.title')}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {CATEGORIES.map((cat) => {
          const alerts = grouped[cat.id] || [];
          const count = new Set(alerts.map(a => a.student_id)).size;
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
                {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                <CatIcon size={14} aria-hidden="true" />
                <span style={{ flex: 1 }}>{cat.label}</span>
                <span style={{
                  background: count > 0 ? cat.color : 'var(--color-border)',
                  color: 'var(--color-surface)',
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
                        onClick={() => handleAlertClick(alert)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAlertClick(alert); } }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)',
                          borderBottom: `1px solid ${cat.border}`,
                          fontSize: 'var(--font-size-xs)', color: cat.color,
                          background: 'var(--color-surface)',
                          cursor: alert.student_id ? 'pointer' : 'default',
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span style={{
                          flex: 1,
                          textDecoration: alert.student_id ? 'underline' : 'none',
                          textDecorationColor: alert.student_id ? `${cat.color}40` : undefined,
                          textUnderlineOffset: '2px',
                        }}>
                          {alert.message}
                        </span>
                        <button
                          onClick={(e) => handleDismiss(e, alert)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 1, color: cat.color, opacity: 0.5, flexShrink: 0,
                          }}
                          aria-label={t('alerts.dismiss')}
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
                  {t('alerts.noAlerts')}
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
