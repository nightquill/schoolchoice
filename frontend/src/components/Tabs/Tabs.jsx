import { useRef, useCallback } from 'react';

// Tabs component — WAI-ARIA Tabs pattern with keyboard navigation
function Tabs({ tabs, activeTab, onChange, children }) {
  const tabRefs = useRef([]);

  const handleKeyDown = useCallback((e, index) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(tabs[index].id);
      return;
    } else {
      return;
    }
    e.preventDefault();
    tabRefs.current[newIndex]?.focus();
  }, [tabs, onChange]);

  const tabListStyle = {
    display: 'flex',
    flexDirection: 'row',
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  };

  const getTabStyle = (isActive) => ({
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-5)',
    fontSize: 'var(--font-size-md)',
    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    background: 'transparent',
    border: 'none',
    borderBottom: isActive
      ? '2px solid var(--color-primary)'
      : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-base)',
    outline: 'none',
    transition: 'none',
  });

  return (
    <div>
      <div
        role="tablist"
        aria-label="Student profile sections"
        style={tabListStyle}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const panelId = `tabpanel-${tab.id}`;
          const tabId = `tab-${tab.id}`;
          return (
            <button
              key={tab.id}
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              ref={(el) => { tabRefs.current[index] = el; }}
              style={getTabStyle(isActive)}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-primary)';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const panelId = `tabpanel-${tab.id}`;
        const tabId = `tab-${tab.id}`;
        return (
          <div
            key={tab.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!isActive}
            style={{ paddingTop: 'var(--space-6)' }}
          >
            {isActive && children}
          </div>
        );
      })}
    </div>
  );
}

export default Tabs;
