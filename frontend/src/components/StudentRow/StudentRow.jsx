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

  const handleClick = () => navigate(`/students/${id}`);
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
      <td style={tdName}>{name}</td>
      <td style={tdSecondary}>{regionDisplay}</td>
      <td style={tdSecondary}>{createdDisplay}</td>
      <td style={tdSecondary}>{'>'}</td>
    </tr>
  );
}

export default StudentRow;
