import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { MoreHorizontal, Trash2 } from 'lucide-react';

function StatusBadge({ student, t }) {
  if (!student.has_account) {
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', background: '#fef3c7', color: '#92400e' }}>
        {t('account.noAccount')}
      </span>
    );
  }
  const status = student.account_status || 'active';
  const styles = {
    active:    { background: '#dcfce7', color: '#166534' },
    suspended: { background: '#fef3c7', color: '#92400e' },
    archived:  { background: '#f3f4f6', color: '#6b7280' },
  };
  const s = styles[status] || styles.active;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', ...s }}>
      {t(`account.${status}`)}
    </span>
  );
}

function ThreeDotMenu({ items }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--border-radius-sm)', color: 'var(--color-text-secondary)' }}
        aria-label="Actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', zIndex: 100,
            background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
            borderRadius: 'var(--border-radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '140px', overflow: 'hidden',
          }}>
            {items.map((item, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)', border: 'none',
                  background: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-base)',
                  color: item.danger ? 'var(--color-error)' : 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-background)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StudentRow({ student, onInvite, onAssignAccount, onDelete, canDelete, onStatusChange, queryClient, selected, onToggleSelect }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id, name, class_name, candidate_number } = student;

  const handleClick = () => navigate(`/students/${id}/profile`);

  const tdBase = { padding: 'var(--space-3) var(--space-4)' };
  const tdName = { ...tdBase, fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-normal)' };
  const tdSecondary = { ...tdBase, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' };

  // Build menu items based on account state
  const menuItems = [];
  const status = student.account_status || 'active';

  if (student.has_account) {
    if (status === 'active') {
      menuItems.push({ label: t('account.suspend'), onClick: () => onStatusChange?.(student, 'suspended') });
      menuItems.push({ label: t('account.archive'), onClick: () => onStatusChange?.(student, 'archived') });
    } else if (status === 'suspended') {
      menuItems.push({ label: t('account.reactivate'), onClick: () => onStatusChange?.(student, 'active') });
      menuItems.push({ label: t('account.archive'), onClick: () => onStatusChange?.(student, 'archived') });
    } else if (status === 'archived') {
      menuItems.push({ label: t('account.reactivate'), onClick: () => onStatusChange?.(student, 'active') });
      menuItems.push({ label: t('account.delete'), onClick: () => onDelete?.(id), danger: true });
    }
  }

  return (
    <tr
      style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', cursor: 'pointer' }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      tabIndex={0}
      role="row"
      aria-label={`View student ${name}`}
    >
      {onToggleSelect && (
        <td style={{ ...tdBase, width: 40, textAlign: 'center' }}>
          <input type="checkbox" checked={!!selected} onChange={(e) => { e.stopPropagation(); onToggleSelect(id); }} onClick={(e) => e.stopPropagation()} aria-label={`Select ${name}`} />
        </td>
      )}
      <td style={tdName}>
        {name}
        {student.has_at_risk_targets && (
          <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px', marginLeft: '8px', verticalAlign: 'middle' }}>AT RISK</span>
        )}
      </td>
      <td style={tdSecondary}>{class_name || '—'}</td>
      <td style={tdSecondary}>{candidate_number || '—'}</td>
      <td style={tdSecondary}>
        {student.best5 != null && (
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
            fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
            background: student.best5 >= 25 ? '#dcfce7' : student.best5 >= 20 ? '#fef9c3' : '#fee2e2',
            color: student.best5 >= 25 ? '#166534' : student.best5 >= 20 ? '#854d0e' : '#991b1b',
          }}>
            {student.best5}
          </span>
        )}
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusBadge student={student} t={t} />
          {!student.has_account && onAssignAccount && (
            <button onClick={(e) => { e.stopPropagation(); onAssignAccount(student); }}
              style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
              {t('account.assignAccount')}
            </button>
          )}
        </div>
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {!student.has_account && canDelete && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)' }}
              aria-label={`Delete ${name}`}
              title={t('account.delete')}
            >
              <Trash2 size={14} />
            </button>
          )}
          <ThreeDotMenu items={menuItems} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{'>'}</span>
        </div>
      </td>
    </tr>
  );
}

export default StudentRow;
