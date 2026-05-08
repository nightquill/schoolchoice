// REQ-096, REQ-099: Academic Plan Page — async plan generation with polling
// REQ-16: Counsellor AI Chat panel
// REQ-17: Template selector + per-section TipTap editing
import { useState, useEffect, useRef, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui';
import { Toast } from '@schoolchoice/ui';
import PlanSectionEditor from '../../components/PlanSectionEditor/PlanSectionEditor';
import { TemplateSelector } from '@schoolchoice/ui';
import { useToast } from '@schoolchoice/ui/hooks/useToast';
import {
  generatePlan,
  getPlanStatus,
  getPlan,
  sendPlanChat,
  setPlanTemplate,
  editPlanSection,
  resetPlanSection,
} from '../../api/plan';
import { exportPlanHTML } from '../../api/entities';
import { getStudent } from '../../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';

const POLL_INTERVAL_MS = 2000;

const TEMPLATES = [
  { id: 'professional', label: 'Professional', headerColor: '#1e3a5f' },
  { id: 'modern', label: 'Modern', headerColor: '#0d9488' },
  { id: 'minimal', label: 'Minimal', headerColor: '#111827' },
];

function buildSectionList(plan) {
  const sections = [
    { key: 'student_summary', label: 'Student Summary' },
  ];
  const schools = plan?.recommended_schools || [];
  const count = Math.min(schools.length || 0, 5);
  for (let i = 0; i < count; i++) {
    sections.push({
      key: `school_${i}_rationale`,
      label: `School ${i + 1} Rationale`,
    });
  }
  sections.push({ key: 'action_plan_notes', label: 'Action Plan Notes' });
  return sections;
}

function AcademicPlan() {
  const { id } = useParams();
  const { toasts, showToast, removeToast } = useToast();

  // --- core state ---
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [planType, setPlanType] = useState('UNIVERSITY');
  const pollRef = useRef(null);

  // --- html export state ---
  const [isExportingHTML, setIsExportingHTML] = useState(false);

  const handleExportHTML = useCallback(async () => {
    if (!plan?.id) return;
    setIsExportingHTML(true);
    try {
      await exportPlanHTML(plan.id);
      showToast('Plan exported as HTML.', 'success');
    } catch {
      showToast('Failed to export HTML. Please try again.', 'error');
    } finally {
      setIsExportingHTML(false);
    }
  }, [plan?.id, showToast]);

  // --- template state ---
  const [activeTemplate, setActiveTemplate] = useState('professional');
  const [templateLoading, setTemplateLoading] = useState(false);

  // --- edit sections state ---
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState(null); // { key, label }
  const [sectionSaving, setSectionSaving] = useState(false);

  // --- chat state ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatDisabled, setChatDisabled] = useState(false); // true when no API key (503)
  const messagesEndRef = useRef(null);
  const chatTextareaRef = useRef(null);

  // --- polling ---
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  };

  const loadPlan = useCallback(async () => {
    try {
      const planData = await getPlan(id);
      setPlan(planData);
      if (planData?.template_id) {
        setActiveTemplate(planData.template_id);
      }
    } catch {
      // non-fatal: ignore
    }
  }, [id]);

  const startPolling = useCallback(() => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPlanStatus(id);
        const statusValue = (status.status || status).toUpperCase();
        setPlanStatus(statusValue);
        if (statusValue === 'DONE') {
          stopPolling();
          const planData = await getPlan(id);
          setPlan(planData);
          if (planData?.template_id) setActiveTemplate(planData.template_id);
          showToast('Plan ready \u2014 view it here.', 'success');
        } else if (statusValue === 'FAILED') {
          stopPolling();
          setError('Plan generation failed. Please try again.');
          showToast('Plan generation failed.', 'error');
        }
      } catch {
        stopPolling();
        setError('Failed to check plan status.');
      }
    }, POLL_INTERVAL_MS);
  }, [id, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      getStudent(id),
      getAccount(),
      getPlanStatus(id).catch(() => null),
      getPlan(id).catch(() => null),
    ])
      .then(([studentData, accountData, statusData, planData]) => {
        setStudent(studentData);
        setAccount(accountData);
        if (planData?.html_content) {
          setPlan(planData);
          if (planData?.template_id) setActiveTemplate(planData.template_id);
          setPlanStatus('DONE');
        } else if (statusData) {
          const sv = (statusData.status || statusData).toUpperCase();
          setPlanStatus(sv);
          if (sv === 'PENDING' || sv === 'RUNNING') {
            startPolling();
          }
        }
      })
      .catch(() => {
        setError('Failed to load plan data.');
      })
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generatePlan(id, planType);
      setPlanStatus('pending');
      setPlan(null);
      startPolling();
    } catch {
      showToast('Failed to start plan generation.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelPolling = () => {
    stopPolling();
    setPlanStatus(null);
  };

  const handleSetTemplate = async (templateId) => {
    if (templateId === activeTemplate || templateLoading) return;
    setTemplateLoading(true);
    try {
      await setPlanTemplate(id, templateId);
      setActiveTemplate(templateId);
      await loadPlan();
    } catch {
      showToast('Failed to change template.', 'error');
    } finally {
      setTemplateLoading(false);
    }
  };

  // --- chat ---
  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatError(null);
    setMessages((prev) => [...prev, { role: 'user', text, id: crypto.randomUUID() }]);
    setChatLoading(true);
    try {
      const data = await sendPlanChat(id, text);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.message || 'Done.', id: crypto.randomUUID() }]);
      // reload plan so charts/content reflect any changes
      await loadPlan();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 503) {
        setChatDisabled(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            text: 'AI chat is not available: Gemini API key not configured.',
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

  // --- section editing ---
  const handleSaveSection = async (htmlContent) => {
    if (!editingSection) return;
    setSectionSaving(true);
    try {
      await editPlanSection(id, editingSection.key, htmlContent);
      setEditingSection(null);
      await loadPlan();
      showToast('Section saved.', 'success');
    } catch {
      showToast('Failed to save section.', 'error');
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
      showToast('Section reset to default.', 'success');
    } catch {
      showToast('Failed to reset section.', 'error');
    } finally {
      setSectionSaving(false);
    }
  };

  const isGenerating = polling || planStatus === 'PENDING' || planStatus === 'RUNNING';
  const hasPlan = !isGenerating && !error && plan?.html_content;

  // --- styles ---
  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
    display: 'flex',
    flexDirection: 'column',
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
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
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
  };

  const timestampStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const contentZoneStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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

  // template button style factory (card-style with mini-preview)
  const templateBtnStyle = (isActive) => ({
    width: '110px',
    height: '72px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: '#fff',
    border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
    borderRadius: '8px',
    cursor: templateLoading ? 'not-allowed' : 'pointer',
    fontSize: '12px',
    fontFamily: 'var(--font-family-base)',
    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
    opacity: templateLoading ? 0.6 : 1,
    transform: isActive ? 'scale(1.02)' : 'scale(1)',
    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
    padding: '6px',
  });

  // plan type button style factory
  const planTypeBtnStyle = (isActive) => ({
    padding: 'var(--space-2) var(--space-3)',
    background: isActive ? 'var(--color-primary)' : 'none',
    color: isActive ? '#fff' : 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: isGenerating ? 'not-allowed' : 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
  });

  // Two-column layout when plan is shown
  const planAreaStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    minHeight: 0,
  };

  const iframeColStyle = {
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

  // Section list styles
  const sectionListStyle = {
    padding: 'var(--space-3) var(--space-6)',
    borderTop: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  };

  // Modal overlay for section editor
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

  const sectionList = buildSectionList(plan);

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/students/${id}/profile`} style={backLinkStyle}>← Back to Profile</Link>

      {/* Main toolbar */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <p style={studentNameStyle}>{student?.full_name || 'Academic Plan'}</p>
          {plan?.version && (
            <p style={versionStyle}>Plan v{plan.version}</p>
          )}
        </div>

        {/* Plan type selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {['UNIVERSITY', 'HIGH_SCHOOL'].map((type) => (
            <button
              key={type}
              onClick={() => setPlanType(type)}
              disabled={isGenerating}
              style={planTypeBtnStyle(planType === type)}
            >
              {type === 'UNIVERSITY' ? 'University Plan' : 'High School Plan'}
            </button>
          ))}
        </div>

        <Button
          label="Generate Plan"
          variant="primary"
          onClick={handleGeneratePlan}
          loading={generating || isGenerating}
          disabled={isGenerating}
        />

        <div style={toolbarRightStyle}>
          {plan?.html_content && (
            <Button label="Print" variant="secondary" onClick={() => window.print()} />
          )}
          {plan?.id && (
            <button
              onClick={handleExportHTML}
              disabled={isExportingHTML || !plan?.id}
              style={{
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
              }}
            >
              <FileDown size={16} />
              {isExportingHTML ? 'Exporting...' : 'Export HTML'}
            </button>
          )}
          {plan?.generated_at && (
            <span style={timestampStyle}>
              Generated: {plan.generated_at.replace('T', ' ').slice(0, 16)}
            </span>
          )}
        </div>
      </div>

      {/* Template selector + Edit Sections toggle — only when plan exists */}
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
          <div style={{ marginLeft: 'auto' }}>
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
              {editMode ? 'Done Editing' : 'Edit Sections'}
            </button>
          </div>
        </div>
      )}

      {/* Section list — visible when editMode is on */}
      {hasPlan && editMode && (
        <div style={sectionListStyle}>
          <p style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
            Select a section to edit:
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
                ✏ {sec.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={contentZoneStyle}><LoadingSpinner label="Loading plan..." /></div>}

      {!loading && (
        <>
          {isGenerating && (
            <div style={{ ...contentZoneStyle, gap: 'var(--space-4)', padding: 'var(--space-8)' }}>
              <LoadingSpinner label="Generating plan..." />
              <div role="status" aria-live="polite">
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', textAlign: 'center', margin: '0 0 var(--space-2) 0' }}>
                  Generating plan…
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
                  This usually takes up to 10 seconds.
                </p>
              </div>
              <Button label="Cancel" variant="secondary" onClick={handleCancelPolling} />
            </div>
          )}

          {!isGenerating && error && (
            <div style={{ ...contentZoneStyle, padding: 'var(--space-8)' }}>
              <ErrorMessage message={error} />
              <Button label="Try Again" variant="primary" onClick={handleGeneratePlan} />
            </div>
          )}

          {hasPlan && (
            <div style={planAreaStyle}>
              {/* Left: plan iframe */}
              <div style={iframeColStyle}>
                <iframe
                  style={iframeStyle}
                  srcDoc={plan.html_content}
                  title={`Academic Plan for ${student?.full_name || 'student'}`}
                  sandbox="allow-same-origin allow-scripts"
                  aria-label="Academic plan document"
                />
              </div>

              {/* Right: AI chat panel */}
              <div style={chatColStyle}>
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

          {!isGenerating && !error && !plan?.html_content && (
            <div style={contentZoneStyle}>
              <EmptyState message="No plan has been generated yet." />
              <Button label="Generate Plan" variant="primary" onClick={handleGeneratePlan} loading={generating} />
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
                Edit: {editingSection.label}
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
                  aria-label="Close editor"
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

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel — extracted sub-component (same file, no separate file needed)
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
      {/* Header */}
      <div style={headerStyle}>
        <p style={headerTitleStyle}>AI Assistant</p>
        <span style={betaBadgeStyle}>beta</span>
      </div>

      {/* No API key persistent notice */}
      {chatDisabled && (
        <div style={noKeyNoticeStyle}>
          AI chat requires a Gemini API key. Configure GEMINI_API_KEY in the backend to enable this feature.
        </div>
      )}

      {/* Message list */}
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

      {/* Error below textarea */}
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

      {/* Input area — hidden when chatDisabled */}
      {!chatDisabled && (
        <div style={inputAreaStyle}>
          <textarea
            ref={chatTextareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            rows={2}
            style={textareaStyle}
            disabled={chatLoading}
            aria-label="Chat message input"
          />
          <button
            onClick={onSend}
            disabled={chatLoading || !chatInput.trim()}
            style={sendBtnStyle}
            aria-label="Send message"
          >
            {chatLoading ? '…' : 'Send'}
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

export default AcademicPlan;
