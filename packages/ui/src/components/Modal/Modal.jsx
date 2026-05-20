import { useEffect, useRef, useCallback, useId } from 'react';
import Button from '../Button/Button';

// Modal — accessible dialog with focus trap, Escape key, and backdrop click
function Modal({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  // Store trigger element on open
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first) first.focus();

    const trapFocus = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [isOpen]);

  // Escape key handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Return focus on close
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-4)',
  };

  const dialogStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: 'var(--shadow-md)',
    padding: 'var(--space-6)',
    maxWidth: '480px',
    width: '100%',
    position: 'relative',
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: '0 0 var(--space-4) 0',
  };

  const bodyStyle = {
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-md)',
    marginBottom: 'var(--space-6)',
    lineHeight: 'var(--line-height-normal)',
    overflowY: 'auto',
    maxHeight: '65vh',
  };

  const footerStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
  };

  const closeBtnStyle = {
    position: 'absolute',
    top: 'var(--space-4)',
    right: 'var(--space-4)',
    background: 'none',
    border: 'none',
    fontSize: 'var(--font-size-lg)',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-base)',
    lineHeight: 1,
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={closeBtnStyle}
          onClick={onClose}
          aria-label={`Close ${title} dialog`}
        >
          &times;
        </button>
        <h2 id={titleId} style={titleStyle}>{title}</h2>
        <div style={bodyStyle}>{children}</div>
        <div style={footerStyle}>
          <Button label={cancelLabel} onClick={onClose} variant="secondary" />
          {onConfirm && (
            <Button
              label={confirmLabel}
              onClick={onConfirm}
              variant={confirmVariant}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;
