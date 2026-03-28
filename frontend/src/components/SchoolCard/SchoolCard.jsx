import { useNavigate } from 'react-router-dom';

// SchoolCard — card displayed in school directory grid
function SchoolCard({ school }) {
  const navigate = useNavigate();

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-5)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  const nameStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const nameZhStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    margin: 0,
  };

  const typeBadgeStyle = {
    display: 'inline-block',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: '2px var(--space-2)',
    background: 'var(--color-background)',
  };

  const metaStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const scholarshipStyle = {
    display: 'inline-block',
    fontSize: 'var(--font-size-xs)',
    background: 'var(--color-success)',
    color: '#ffffff',
    borderRadius: 'var(--border-radius-sm)',
    padding: '2px var(--space-2)',
  };

  return (
    <div
      style={cardStyle}
      onClick={() => navigate(`/schools/${school.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View profile for ${school.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/schools/${school.id}`);
        }
      }}
      onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-primary)'; }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
    >
      <p style={nameStyle}>{school.name}</p>
      {school.name_zh && <p style={nameZhStyle}>{school.name_zh}</p>}
      <div>
        <span style={typeBadgeStyle}>{school.type}</span>
      </div>
      {school.location && (
        <p style={metaStyle}>{'\u{1F4CD}'} {school.location}</p>
      )}
      {school.minimum_entry_score != null && (
        <p style={metaStyle}>Min. score: {school.minimum_entry_score}</p>
      )}
      {school.notable_programs?.length > 0 && (
        <div style={{ marginTop: 'var(--space-1)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Programs</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {school.notable_programs.slice(0, 4).map((p, i) => (
              <span key={i} style={{ fontSize: '10px', background: 'var(--color-background)', border: 'var(--border-width) solid var(--color-border)', borderRadius: '4px', padding: '1px 6px', color: 'var(--color-text-secondary)' }}>
                {p}
              </span>
            ))}
            {school.notable_programs.length > 4 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', padding: '1px 6px' }}>
                +{school.notable_programs.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
      {school.major_requirements && Object.keys(school.major_requirements).length > 0 && (
        <div style={{ marginTop: 'var(--space-1)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Majors</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {Object.keys(school.major_requirements).slice(0, 3).map((major) => (
              <span key={major} style={{ fontSize: '10px', background: 'rgba(37,99,235,0.08)', border: 'var(--border-width) solid rgba(37,99,235,0.2)', borderRadius: '4px', padding: '1px 6px', color: 'var(--color-primary)' }}>
                {major}
              </span>
            ))}
            {Object.keys(school.major_requirements).length > 3 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', padding: '1px 6px' }}>
                +{Object.keys(school.major_requirements).length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
      {school.scholarship_available && (
        <span style={scholarshipStyle}>Scholarship available</span>
      )}
    </div>
  );
}

export default SchoolCard;
