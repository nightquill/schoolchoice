import { useEffect, useRef } from 'react';

const TYPE_COLORS = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-primary)',
};

// Individual toast item
function ToastItem({ toast, onClose }) {
  const timerRef = useRef(null);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    timerRef.current = setTimeout(() => onClose(toast.id), duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onClose]);

  const toastStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--border-radius-md)',
    background: TYPE_COLORS[toast.type] || TYPE_COLORS.info,
    color: '#ffffff',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    boxShadow: 'var(--shadow-md)',
    marginBottom: 'var(--space-2)',
    minWidth: '260px',
    maxWidth: '420px',
  };

  const closeBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 'var(--font-size-md)',
    padding: '0 var(--space-1)',
    lineHeight: 1,
    opacity: 0.8,
    fontFamily: 'var(--font-family-base)',
    flexShrink: 0,
  };

  return (
    <div style={toastStyle} role="status" aria-live="polite" aria-atomic="true">
      <span>{toast.message}</span>
      <button
        style={closeBtnStyle}
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

// Toast container — renders at fixed bottom-right
function Toast({ toasts, removeToast }) {
  const containerStyle = {
    position: 'fixed',
    bottom: 'var(--space-6)',
    right: 'var(--space-6)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  };

  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}

export default Toast;
