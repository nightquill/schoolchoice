import { useRef } from 'react';

// StarRating — accessible 1-5 star rating using radiogroup pattern
function StarRating({ value, onChange, readOnly = false, label = 'Rating' }) {
  const groupRef = useRef(null);

  const handleKeyDown = (e, starValue) => {
    if (readOnly) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(5, starValue + 1);
      onChange?.(next);
      // Move focus to next star
      const stars = groupRef.current?.querySelectorAll('[role="radio"]');
      stars?.[next - 1]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, starValue - 1);
      onChange?.(prev);
      const stars = groupRef.current?.querySelectorAll('[role="radio"]');
      stars?.[prev - 1]?.focus();
    }
  };

  const groupStyle = {
    display: 'flex',
    gap: 'var(--space-1)',
    alignItems: 'center',
  };

  const getStarStyle = (filled) => ({
    background: 'none',
    border: 'none',
    fontSize: 'var(--font-size-lg)',
    cursor: readOnly ? 'default' : 'pointer',
    color: filled ? 'var(--color-warning)' : 'var(--color-border)',
    padding: '2px',
    fontFamily: 'var(--font-family-base)',
    lineHeight: 1,
  });

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={`Rating for ${label}`}
      style={groupStyle}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (value || 0);
        const isCurrent = star === value;
        return (
          <button
            key={star}
            role="radio"
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            aria-checked={isCurrent}
            tabIndex={isCurrent || (!value && star === 1) ? 0 : -1}
            style={getStarStyle(filled)}
            onClick={() => !readOnly && onChange?.(star)}
            onKeyDown={(e) => handleKeyDown(e, star)}
            disabled={readOnly}
          >
            {filled ? '\u2605' : '\u2606'}
          </button>
        );
      })}
    </div>
  );
}

export default StarRating;
