import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover';

const TIER_STYLES = {
  HIGH: {
    background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
    border: '1px solid var(--color-success)',
    color: 'var(--color-success)',
  },
  MEDIUM: {
    background: '#fef9c3',
    border: '1px solid var(--color-warning)',
    color: '#a16207',
  },
  LOW: {
    background: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
  },
};

const TIER_TOOLTIPS = {
  HIGH: 'All eligibility data complete.',
};

function ConfidenceBadge({ tier, missingFields = [] }) {
  const [open, setOpen] = useState(false);
  const hoverTimeout = useRef(null);

  const tierKey = (tier || '').toUpperCase();
  const styles = TIER_STYLES[tierKey] || TIER_STYLES.LOW;

  const tooltipText = tierKey === 'HIGH'
    ? TIER_TOOLTIPS.HIGH
    : missingFields.length > 0
      ? `Missing: ${missingFields.join(', ')}. Confidence reflects available data only.`
      : 'Confidence reflects available data only.';

  const ariaLabel = `Confidence: ${tierKey} - ${tooltipText}`;

  const badgeStyle = {
    display: 'inline-block',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    lineHeight: '1',
    minHeight: '22px',
    cursor: 'default',
    ...styles,
  };

  // Clean up hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setOpen(true), 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setOpen(false);
  };

  const handleFocus = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setOpen(true);
  };

  const handleBlur = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          style={badgeStyle}
          aria-label={ariaLabel}
          tabIndex={0}
          role="status"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {tierKey}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          maxWidth: '280px',
        }}
      >
        {tooltipText}
      </PopoverContent>
    </Popover>
  );
}

export default ConfidenceBadge;
