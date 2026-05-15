// Shared ChatPanel + MessageBubble for plan-generation chat UIs
// Extracted from ConsultantTask — used by both AcademicPlan and ConsultantTask
import { useTranslation } from '@schoolchoice/ui/i18n';

function ChatPanel({
  messages,
  chatInput,
  setChatInput,
  chatLoading,
  chatError,
  chatDisabled,
  messagesEndRef,
  chatTextareaRef,
  onSend,
  onKeyDown,
  apiKeyNotice,
  hintText,
}) {
  const { t } = useTranslation();

  const panelStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-base)',
  };

  const headerStyle = {
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    flexShrink: 0,
  };

  const headerTitleStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const betaBadgeStyle = {
    fontSize: '10px',
    fontWeight: 'var(--font-weight-medium)',
    color: '#fff',
    background: 'var(--color-primary)',
    borderRadius: '3px',
    padding: '1px 5px',
    lineHeight: '1.4',
  };

  const noKeyNoticeStyle = {
    margin: 'var(--space-2) var(--space-4)',
    padding: 'var(--space-3)',
    background: '#fffbeb',
    border: '1px solid #fbbf24',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-xs)',
    color: '#92400e',
    lineHeight: '1.5',
  };

  const messageListStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-3) var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  const emptyHintStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    lineHeight: '1.6',
    padding: 'var(--space-4)',
    fontStyle: 'italic',
  };

  const inputAreaStyle = {
    padding: 'var(--space-3) var(--space-4)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-end',
    flexShrink: 0,
  };

  const textareaStyle = {
    flex: 1,
    resize: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-2)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    color: 'var(--color-text-primary)',
    background: '#fff',
    minHeight: '60px',
    maxHeight: '120px',
    lineHeight: '1.5',
    outline: 'none',
  };

  const sendBtnStyle = {
    padding: 'var(--space-2) var(--space-3)',
    background: chatLoading || !chatInput.trim() || chatDisabled
      ? 'var(--color-border)'
      : 'var(--color-primary)',
    color: chatLoading || !chatInput.trim() || chatDisabled
      ? 'var(--color-text-secondary)'
      : '#fff',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    cursor: chatLoading || !chatInput.trim() || chatDisabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: 'var(--font-weight-medium)',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-end',
    marginBottom: '1px',
  };

  const noticeText = apiKeyNotice || t('consultant.apiKeyRequired');
  const emptyText = hintText || t('plan.aiPlaceholder');

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <p style={headerTitleStyle}>{t('plan.aiAssistant')}</p>
        <span style={betaBadgeStyle}>{t('plan.beta')}</span>
      </div>

      {chatDisabled && (
        <div style={noKeyNoticeStyle}>
          {noticeText}
        </div>
      )}

      <div style={messageListStyle}>
        {messages.length === 0 && (
          <p style={emptyHintStyle}>
            {emptyText}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {chatError && (
        <div style={{
          padding: '0 var(--space-4) var(--space-2)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-error)',
          fontFamily: 'var(--font-family-base)',
        }}>
          {chatError}
        </div>
      )}

      {!chatDisabled && (
        <div style={inputAreaStyle}>
          <textarea
            ref={chatTextareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("plan.typeMessage")}
            rows={2}
            style={textareaStyle}
            disabled={chatLoading}
            aria-label="Chat message input"
          />
          <button
            onClick={onSend}
            disabled={chatLoading || !chatInput.trim()}
            style={sendBtnStyle}
            aria-label={t('plan.sendMessage')}
          >
            {chatLoading ? '...' : t('plan.send')}
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const wrapStyle = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
  };

  const bubbleStyle = {
    maxWidth: '85%',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: '10px',
    fontSize: 'var(--font-size-xs)',
    lineHeight: '1.5',
    fontFamily: 'var(--font-family-base)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...(isUser
      ? {
          background: 'var(--color-primary)',
          color: '#fff',
          borderBottomRightRadius: '3px',
        }
      : isSystem
      ? {
          background: '#fef3c7',
          color: '#78350f',
          border: '1px solid #fbbf24',
          borderRadius: '6px',
          fontStyle: 'italic',
        }
      : {
          background: '#f3f4f6',
          color: 'var(--color-text-primary)',
          borderBottomLeftRadius: '3px',
        }),
  };

  return (
    <div style={wrapStyle}>
      <div style={bubbleStyle}>{message.text}</div>
    </div>
  );
}

export { ChatPanel, MessageBubble };
