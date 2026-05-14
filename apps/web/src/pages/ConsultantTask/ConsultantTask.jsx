// Phase 5: Generalized ConsultantTask page with SSE streaming
// Replaces polling-based plan generation with live token streaming via EventSource
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { FileDown, StopCircle } from 'lucide-react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import SSEStreamDisplay from '../../components/SSEStreamDisplay/SSEStreamDisplay';
import PlanSectionEditor from '../../components/PlanSectionEditor/PlanSectionEditor';
import { TemplateSelector } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { getStudent } from '../../api/students';
import { saveConsultantTask, getConsultantTaskStatus, sendConsultantChat } from '../../api/consultant';
import { getPlan, setPlanTemplate, editPlanSection, resetPlanSection } from '../../api/plan';
import { exportPlanHTML } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

function ConsultantTask() {
  const { t } = useTranslation();  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = 'academic_plan'; // hardcoded for school choice; future: from route param
  // --- core state ---
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamTokens, setStreamTokens] = useState('');
  const [streamError, setStreamError] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const streamTokensRef = useRef(''); // CRITICAL: ref to avoid stale closure in done handler

  // --- html export state ---
  const [isExportingHTML, setIsExportingHTML] = useState(false);

  // --- template state ---
  const [activeTemplate, setActiveTemplate] = useState('professional');
  const [templateLoading, setTemplateLoading] = useState(false);

  // --- edit sections state ---
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionSaving, setSectionSaving] = useState(false);

  // --- counselor metrics toggle ---
  const [showCounselorMetrics, setShowCounselorMetrics] = useState(false);
  const iframeRef = useRef(null);

  // --- chat state ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatDisabled, setChatDisabled] = useState(false);
  const messagesEndRef = useRef(null);
  const chatTextareaRef = useRef(null);

  // --- mobile chat toggle ---
  const [showChat, setShowChat] = useState(false);

  // --- data loading ---
  const loadPlan = useCallback(async () => {
    try {
      const planData = await getPlan(id);
      setPlan(planData);
      if (planData?.template_id) {
        setActiveTemplate(planData.template_id);
      }
    } catch {
      // non-fatal
    }
  }, [id]);

  useEffect(() => {
    Promise.all([
      getStudent(id),
      getAccount(),
      getPlan(id).catch(() => null),
    ])
      .then(([studentData, accountData, planData]) => {
        setStudent(studentData);
        setAccount(accountData);
        if (planData?.html_content) {
          setPlan(planData);
          if (planData?.template_id) setActiveTemplate(planData.template_id);
        }
      })
      .catch(() => {
        setError('Failed to load plan data.');
      })
      .finally(() => setLoading(false));

    // Cleanup EventSource on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [id]);

  // auto-scroll chat on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- Generate Plan handler (SSE streaming) ---
  const handleGenerate = useCallback(() => {
    setStreaming(true);
    setStreamTokens('');
    setStreamError(null);
    streamTokensRef.current = ''; // reset ref

    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${base}/api/v1/consultant/tasks/${taskId}/stream?entity_id=${id}&force=true&token=${token}`;
    const source = new EventSource(url);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      // Accumulate in BOTH state (for rendering) and ref (for done handler)
      streamTokensRef.current += event.data;
      setStreamTokens((prev) => prev + event.data);
    };

    source.addEventListener('done', async () => {
      source.close();
      eventSourceRef.current = null;
      // Use ref.current -- NOT streamTokens state (which would be stale)
      const accumulatedTokens = streamTokensRef.current;
      try {
        const result = await saveConsultantTask(taskId, id, accumulatedTokens);
        setPlan(result);
        toast.success(t('plan.planGenerated'));
      } catch (err) {
        setStreamError('Failed to save plan. Please try again.');
      }
      setStreaming(false);
      setStreamTokens('');
      streamTokensRef.current = '';
    });

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setStreamError('Generation was interrupted. Please try again.');
      setStreaming(false);
    };
  }, [id, taskId]);
  // NOTE: streamTokens is NOT in the dependency array -- we use the ref instead

  // Auto-start generation when navigated with ?generate=true
  const autoGenerateTriggered = useRef(false);
  useEffect(() => {
    if (!loading && student && searchParams.get('generate') === 'true' && !autoGenerateTriggered.current) {
      autoGenerateTriggered.current = true;
      setSearchParams({}, { replace: true });
      handleGenerate();
    }
  }, [loading, student, searchParams, setSearchParams, handleGenerate]);

  // --- {t('consultant.stopGeneration')} handler ---
  const handleStopGeneration = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
    setStreamTokens('');
    streamTokensRef.current = '';
    setStreamError(null);
  }, []);

  // --- Export HTML ---
  const handleExportHTML = useCallback(async () => {
    if (!plan?.id) return;
    setIsExportingHTML(true);
    try {
      await exportPlanHTML(plan.id);
      toast.success('Plan exported as HTML.');
    } catch {
      toast.error('Failed to export HTML. Please try again.');
    } finally {
      setIsExportingHTML(false);
    }
  }, [plan?.id]);

  // --- Template change ---
  const handleSetTemplate = async (templateId) => {
    if (templateId === activeTemplate || templateLoading) return;
    setTemplateLoading(true);
    try {
      await setPlanTemplate(id, templateId);
      setActiveTemplate(templateId);
      await loadPlan();
    } catch {
      toast.error(t('plan.templateFailed'));
    } finally {
      setTemplateLoading(false);
    }
  };

  // --- Chat ---
  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatError(null);
    setMessages((prev) => [...prev, { role: 'user', text, id: crypto.randomUUID() }]);
    setChatLoading(true);
    try {
      const data = await sendConsultantChat(taskId, id, text);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.message || 'Done.', id: crypto.randomUUID() }]);
      await loadPlan();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 503) {
        setChatDisabled(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            text: 'AI chat is not available: AI provider API key not configured.',
            id: crypto.randomUUID(),
          },
        ]);
      } else if (status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            text: 'Daily limit of 20 AI chat requests reached for this plan.',
            id: crypto.randomUUID(),
          },
        ]);
      } else {
        setChatError('Failed to send message. Please try again.');
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // --- Section editing ---
  const handleSaveSection = async (htmlContent) => {
    if (!editingSection) return;
    setSectionSaving(true);
    try {
      await editPlanSection(id, editingSection.key, htmlContent);
      setEditingSection(null);
      await loadPlan();
      toast.success(t('plan.sectionSaved'));
    } catch {
      toast.error(t('plan.sectionSaveFailed'));
    } finally {
      setSectionSaving(false);
    }
  };

  const handleResetSection = async () => {
    if (!editingSection) return;
    setSectionSaving(true);
    try {
      await resetPlanSection(id, editingSection.key);
      setEditingSection(null);
      await loadPlan();
      toast.success(t('plan.sectionReset'));
    } catch {
      toast.error(t('plan.sectionResetFailed'));
    } finally {
      setSectionSaving(false);
    }
  };

  // --- section list builder ---
  function buildSectionList(planData) {
    const sections = [{ key: 'student_summary', label: 'Student Summary' }];
    const schools = planData?.recommended_schools || [];
    const count = Math.min(schools.length || 0, 5);
    for (let i = 0; i < count; i++) {
      sections.push({ key: `school_${i}_rationale`, label: `School ${i + 1} Rationale` });
    }
    sections.push({ key: 'action_plan_notes', label: 'Action Plan Notes' });
    return sections;
  }

  const hasPlan = !streaming && !error && plan?.html_content;
  const sectionList = buildSectionList(plan);

  // --- styles ---
  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
    display: 'flex',
    flexDirection: 'column',
  };

  const backLinkStyle = {
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

  const toolbarStyle = {
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

  const toolbarLeftStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const studentNameStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const versionStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    margin: 0,
  };

  const toolbarRightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexShrink: 0,
    flexWrap: 'wrap',
  };

  const timestampStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const planAreaStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    minHeight: 0,
  };

  const leftColStyle = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  const iframeStyle = {
    width: '100%',
    flex: 1,
    border: 'none',
    background: 'var(--color-background)',
    display: 'block',
    minHeight: 'calc(100vh - 160px)',
  };

  const chatColStyle = {
    width: '360px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    minHeight: 0,
  };

  const contentZoneStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const sectionListStyle = {
    padding: 'var(--space-3) var(--space-6)',
    borderTop: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  };

  const modalBackdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-4)',
  };

  const modalDialogStyle = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    padding: 'var(--space-6)',
    width: '640px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  // Stop generation button style
  const stopBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-base)',
  };

  // Export HTML button style
  const exportBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-primary)',
    cursor: isExportingHTML ? 'wait' : 'pointer',
    fontFamily: 'var(--font-family-base)',
  };

  // Mobile chat toggle style
  const chatToggleStyle = {
    padding: 'var(--space-2) var(--space-4)',
    background: showChat ? 'var(--color-primary)' : 'var(--color-surface)',
    color: showChat ? '#fff' : 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: 'var(--font-weight-medium)',
    width: '100%',
    textAlign: 'center',
    marginTop: 'var(--space-2)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/students/${id}/profile`} style={backLinkStyle}>
        {'\u2190'} {t('consultant.backTo')} {student?.full_name || 'Profile'}
      </Link>

      {/* Main toolbar */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <p style={studentNameStyle}>{student?.full_name || 'Consultant Task'}</p>
          {plan?.version && <p style={versionStyle}>Plan v{plan.version}</p>}
        </div>

        <div style={toolbarRightStyle}>
          <Button
            onClick={handleGenerate}
            disabled={streaming}
          >
            {streaming ? t('plan.generating') : t('plan.generatePlan')}
          </Button>

          {streaming && (
            <button onClick={handleStopGeneration} style={stopBtnStyle}>
              <StopCircle size={16} />
              {t('consultant.stopGeneration')}
            </button>
          )}

          {plan?.id && (
            <button
              onClick={handleExportHTML}
              disabled={isExportingHTML || !plan?.id}
              style={exportBtnStyle}
            >
              <FileDown size={16} />
              {isExportingHTML ? t('plan.exporting') : t('plan.exportHtml')}
            </button>
          )}

          {plan?.generated_at && (
            <span style={timestampStyle}>
              {t('plan.generated')} {plan.generated_at.replace('T', ' ').slice(0, 16)}
            </span>
          )}
        </div>
      </div>

      {/* Template selector + Edit Sections toggle -- only when plan exists */}
      {hasPlan && (
        <div style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--space-2) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}>
          <TemplateSelector
            templateId={activeTemplate}
            onTemplateChange={handleSetTemplate}
            isPending={templateLoading}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={showCounselorMetrics}
                onChange={(e) => {
                  setShowCounselorMetrics(e.target.checked);
                  if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                      e.target.checked ? 'show-counselor' : 'hide-counselor',
                      '*'
                    );
                  }
                }}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              {t('consultant.counselorView')}
            </label>
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: editMode ? 'var(--color-primary)' : 'none',
                color: editMode ? '#fff' : 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-base)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              {editMode ? t('plan.doneEditing') : t('plan.editSections')}
            </button>
          </div>
        </div>
      )}

      {/* Section list -- visible when editMode is on */}
      {hasPlan && editMode && (
        <div style={sectionListStyle}>
          <p style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
            {t('plan.selectSection')}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {sectionList.map((sec) => (
              <button
                key={sec.key}
                onClick={() => setEditingSection(sec)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-base)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={contentZoneStyle}><LoadingSpinner label={t("plan.loading")} /></div>}

      {!loading && (
        <>
          {/* SSE Streaming display */}
          {streaming && (
            <div style={planAreaStyle}>
              <div style={leftColStyle}>
                <SSEStreamDisplay
                  tokens={streamTokens}
                  isStreaming={streaming}
                  error={streamError}
                  onRetry={handleGenerate}
                />
              </div>
              {/* Desktop chat during streaming */}
              <div style={chatColStyle} className="consultant-chat-desktop">
                <ChatPanel
                  messages={messages}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  chatLoading={chatLoading}
                  chatError={chatError}
                  chatDisabled={true}
                  messagesEndRef={messagesEndRef}
                  chatTextareaRef={chatTextareaRef}
                  onSend={handleSendChat}
                  onKeyDown={handleChatKeyDown}
                />
              </div>
            </div>
          )}

          {/* Error display (non-streaming error) */}
          {!streaming && error && (
            <div style={{ ...contentZoneStyle, padding: 'var(--space-8)' }}>
              <ErrorMessage message={error} />
              <Button onClick={handleGenerate}>{t('consultant.tryAgain')}</Button>
            </div>
          )}

          {/* Stream error (from SSE failure) */}
          {!streaming && streamError && !error && (
            <div style={{ ...contentZoneStyle, padding: 'var(--space-8)' }}>
              <SSEStreamDisplay
                tokens=""
                isStreaming={false}
                error={streamError}
                onRetry={handleGenerate}
              />
            </div>
          )}

          {/* Plan display (two-column) */}
          {hasPlan && (
            <div style={planAreaStyle}>
              <div style={leftColStyle}>
                <iframe
                  ref={iframeRef}
                  style={iframeStyle}
                  srcDoc={plan.html_content}
                  title={`Plan for ${student?.full_name || 'student'}`}
                  sandbox="allow-same-origin allow-scripts"
                  aria-label="Consultant plan document"
                />
              </div>
              {/* Desktop chat panel */}
              <div style={chatColStyle} className="consultant-chat-desktop">
                <ChatPanel
                  messages={messages}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  chatLoading={chatLoading}
                  chatError={chatError}
                  chatDisabled={chatDisabled}
                  messagesEndRef={messagesEndRef}
                  chatTextareaRef={chatTextareaRef}
                  onSend={handleSendChat}
                  onKeyDown={handleChatKeyDown}
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!streaming && !streamError && !error && !plan?.html_content && (
            <div style={contentZoneStyle}>
              <EmptyState
                message="No plan has been generated yet."
                description="Click Generate Plan to create a school choice plan for this student."
              />
            </div>
          )}

          {/* Mobile chat toggle + panel */}
          {(hasPlan || streaming) && (
            <div className="consultant-chat-mobile">
              <button onClick={() => setShowChat((v) => !v)} style={chatToggleStyle}>
                {showChat ? t('plan.aiAssistant') : t('consultant.showChat')}
              </button>
              {showChat && (
                <div style={{ borderTop: '1px solid var(--color-border)', minHeight: '300px' }}>
                  <ChatPanel
                    messages={messages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    chatLoading={chatLoading}
                    chatError={chatError}
                    chatDisabled={chatDisabled || streaming}
                    messagesEndRef={messagesEndRef}
                    chatTextareaRef={chatTextareaRef}
                    onSend={handleSendChat}
                    onKeyDown={handleChatKeyDown}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Section editor modal */}
      {editingSection && (
        <div style={modalBackdropStyle} onClick={() => !sectionSaving && setEditingSection(null)}>
          <div style={modalDialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-base)' }}>
                {t('plan.editLabel')} {editingSection.label}
              </h2>
              {!sectionSaving && (
                <button
                  onClick={() => setEditingSection(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--font-size-lg)',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family-base)',
                    lineHeight: 1,
                  }}
                  aria-label={t('plan.closeEditor')}
                >
                  &times;
                </button>
              )}
            </div>
            <PlanSectionEditor
              sectionKey={editingSection.key}
              initialHtml={''}
              onSave={handleSaveSection}
              onReset={handleResetSection}
              onCancel={() => setEditingSection(null)}
              saving={sectionSaving}
            />
          </div>
        </div>
      )}

      {/* Responsive styles for mobile/desktop chat visibility */}
      <style>{`
        .consultant-chat-mobile { display: none; }
        @media (max-width: 768px) {
          .consultant-chat-desktop { display: none !important; }
          .consultant-chat-mobile { display: block; }
        }
        @media (min-width: 769px) {
          .consultant-chat-mobile { display: none !important; }
        }
      `}</style>

    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel -- extracted sub-component (reused from AcademicPlan pattern)
// ---------------------------------------------------------------------------
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
}) {
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

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <p style={headerTitleStyle}>{t('plan.aiAssistant')}</p>
        <span style={betaBadgeStyle}>{t('plan.beta')}</span>
      </div>

      {chatDisabled && (
        <div style={noKeyNoticeStyle}>
          AI chat requires an API key. Configure AI_API_KEY in the backend to enable this feature.
        </div>
      )}

      <div style={messageListStyle}>
        {messages.length === 0 && (
          <p style={emptyHintStyle}>
            Ask me to adjust a school&apos;s rationale, reorder schools, change action item priorities&hellip;
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

export default ConsultantTask;
