import { useRef, useEffect } from 'react';

function SSEStreamDisplay({ tokens, isStreaming, error, onRetry }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new tokens
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [tokens, isStreaming]);

  // After done (not streaming, has tokens): scroll to top
  useEffect(() => {
    if (containerRef.current && !isStreaming && tokens) {
      containerRef.current.scrollTop = 0;
    }
  }, [isStreaming, tokens]);

  // Idle state: hidden
  if (!isStreaming && !error && !tokens) {
    return null;
  }

  const containerStyle = {
    overflowY: 'auto',
    minHeight: '200px',
    maxHeight: 'calc(100vh - 220px)',
    padding: 'var(--space-4)',
    fontFamily: 'var(--font-family-base)',
    fontSize: 'var(--font-size-md)',
    lineHeight: '1.6',
    color: 'var(--color-text-primary)',
    position: 'relative',
  };

  const errorContainerStyle = {
    ...containerStyle,
    border: '1px solid var(--color-error)',
    borderRadius: 'var(--border-radius-md)',
  };

  // Error state
  if (error) {
    return (
      <div
        ref={containerRef}
        style={errorContainerStyle}
        role="status"
        aria-live="polite"
      >
        <p style={{
          color: 'var(--color-error)',
          fontSize: 'var(--font-size-md)',
          margin: '0 0 var(--space-4) 0',
        }}>
          {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      role="status"
      aria-live="polite"
    >
      {/* Progress indicator when streaming */}
      {isStreaming && (
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          margin: '0 0 var(--space-3) 0',
        }}>
          Generating plan...
        </p>
      )}

      {/* Streaming text with blinking cursor */}
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
        {tokens}
        {isStreaming && <span className="stream-cursor" />}
      </p>

      {/* Inline style for blinking cursor animation */}
      {isStreaming && (
        <style>{`
          .stream-cursor::after {
            content: '\\25AE';
            display: inline;
            animation: blink 1s step-end infinite;
            color: var(--color-text-primary);
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      )}
    </div>
  );
}

export default SSEStreamDisplay;
