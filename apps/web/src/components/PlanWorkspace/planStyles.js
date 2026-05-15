/**
 * Shared style definitions for AcademicPlan and ConsultantTask workspaces.
 * ConsultantTask versions are canonical where the two diverged.
 */

export const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
  display: 'flex',
  flexDirection: 'column',
};

export const backLinkStyle = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-primary)',
  textDecoration: 'none',
  display: 'inline-block',
  padding: 'var(--space-2) var(--space-6)',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  width: '100%',
  boxSizing: 'border-box',
};

export const toolbarStyle = {
  background: 'var(--color-surface)',
  borderBottom: '1px solid var(--color-border)',
  padding: 'var(--space-3) var(--space-6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  flexShrink: 0,
  flexWrap: 'wrap',
};

export const toolbarLeftStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

export const toolbarRightStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexShrink: 0,
  flexWrap: 'wrap',
};

export const studentNameStyle = {
  fontSize: 'var(--font-size-xl)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--color-text-primary)',
  margin: 0,
};

export const versionStyle = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-secondary)',
  margin: 0,
};

export const timestampStyle = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-secondary)',
};

export const contentZoneStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

export const planAreaStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  minHeight: 0,
};

export const iframeColStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

export const iframeStyle = {
  width: '100%',
  flex: 1,
  border: 'none',
  background: 'var(--color-background)',
  display: 'block',
  minHeight: 'calc(100vh - 160px)',
};

export const chatColStyle = {
  width: '360px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  minHeight: 0,
};

export const sectionListStyle = {
  padding: 'var(--space-3) var(--space-6)',
  borderTop: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
};

export const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)',
};

export const modalDialogStyle = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--border-radius-lg)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  padding: 'var(--space-6)',
  width: '640px',
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflow: 'auto',
};
