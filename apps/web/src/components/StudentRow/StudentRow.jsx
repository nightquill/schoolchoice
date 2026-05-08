import { useNavigate } from 'react-router-dom';

function StudentRow({ student }) {
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
      <td style={tdSecondary}>{'>'}</td>
    </tr>
  );
}

export default StudentRow;
