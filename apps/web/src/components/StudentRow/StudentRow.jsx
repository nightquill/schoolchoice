import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function StudentRow({ student, onInvite, onAssignAccount, queryClient, selected, onToggleSelect }) {
  const navigate = useNavigate();
  const { id, name, target_region, created_at } = student;

  const regionDisplay = target_region === 'local' ? 'Local' : 'International';
  const createdDisplay = created_at ? created_at.slice(0, 10) : '';

  const rowStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    cursor: 'pointer',
  };

  const handleClick = () => navigate(`/students/${id}/profile`);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleClick();
  };

  const tdBase = {
    padding: 'var(--space-3) var(--space-4)',
  };

  const tdName = {
    ...tdBase,
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    fontWeight: 'var(--font-weight-normal)',
  };

  const tdSecondary = {
    ...tdBase,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  return (
    <tr
      style={rowStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="row"
      aria-label={`View student ${name}`}
    >
      {onToggleSelect && (
        <td style={{ ...tdBase, width: 40, textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(id);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${name}`}
          />
        </td>
      )}
      <td style={tdName}>
        {name}
        {student.has_at_risk_targets && (
          <span style={{
            display: 'inline-block',
            background: '#dc2626',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '8px',
            marginLeft: '8px',
            verticalAlign: 'middle',
          }}>AT RISK</span>
        )}
      </td>
      <td style={tdSecondary}>{regionDisplay}</td>
      <td style={tdSecondary}>{createdDisplay}</td>
      <td style={tdSecondary}>
        {student.best5 != null && (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            background: student.best5 >= 25 ? '#dcfce7' : student.best5 >= 20 ? '#fef9c3' : '#fee2e2',
            color: student.best5 >= 25 ? '#166534' : student.best5 >= 20 ? '#854d0e' : '#991b1b',
          }}>
            {student.best5}
          </span>
        )}
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {student.has_account ? (
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', background: '#dcfce7', color: '#166534' }}>Active</span>
          ) : student.invite_status === 'invited' ? (
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', background: '#dbeafe', color: '#1e40af' }}>Invited</span>
          ) : (
            <>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', background: '#fef3c7', color: '#92400e' }}>No Account</span>
              {onAssignAccount && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignAccount(student);
                  }}
                  style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)' }}
                >
                  Assign Account
                </button>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const email = student.email || window.prompt('Enter student email:');
                  if (!email) return;
                  try {
                    const result = await onInvite(student.id, email);
                    toast.success(`Invite link copied for ${name}`);
                    if (navigator.clipboard) navigator.clipboard.writeText(window.location.origin + result.invite_url);
                    queryClient.invalidateQueries({ queryKey: ['students'] });
                  } catch (err) {
                    toast.error(err?.response?.data?.detail || 'Failed to invite');
                  }
                }}
                style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)' }}
              >
                Invite
              </button>
            </>
          )}
        </div>
      </td>
      <td style={tdSecondary}>{'>'}</td>
    </tr>
  );
}

export default StudentRow;
