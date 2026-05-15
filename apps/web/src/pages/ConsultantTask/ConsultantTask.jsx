// Phase 5: Generalized ConsultantTask page with SSE streaming
// Refactored to use shared usePlanWorkspace, ChatPanel, and planStyles
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { FileDown, StopCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import SSEStreamDisplay from '../../components/SSEStreamDisplay/SSEStreamDisplay';
import PlanProgress from '../../components/PlanProgress/PlanProgress';
import PlanSectionEditor from '../../components/PlanSectionEditor/PlanSectionEditor';
import PlanRadarChart from '../../components/PlanRadarChart/PlanRadarChart';
import { TemplateSelector } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { saveConsultantTask, sendConsultantChat } from '../../api/consultant';
import { exportPlanPDF } from '../../api/plan';
import { getGrades } from '../../api/grades';
import { getTargets } from '../../api/targets';
import { getAllProgrammes } from '../../api/jupas';
import { ChatPanel } from '../../components/PlanChat/PlanChat';
import usePlanWorkspace from '../../hooks/usePlanWorkspace';
import {
  pageStyle,
  backLinkStyle,
  toolbarStyle,
  toolbarLeftStyle,
  toolbarRightStyle,
  studentNameStyle,
  versionStyle,
  timestampStyle,
  contentZoneStyle,
  planAreaStyle,
  iframeColStyle,
  iframeStyle,
  chatColStyle,
  sectionListStyle,
  modalBackdropStyle,
  modalDialogStyle,
} from '../../components/PlanWorkspace/planStyles';
import { useTranslation } from '@schoolchoice/ui/i18n';

const JUPAS_MILESTONES = [
  { label: 'JUPAS application opens', date: '2025-09-01' },
  { label: 'Reference letters deadline', date: '2025-10-31' },
  { label: 'Personal statement draft', date: '2025-11-15' },
  { label: 'Band A submission deadline', date: '2025-12-08' },
  { label: 'HKDSE exam period', date: '2026-03-28' },
  { label: 'HKDSE exam ends', date: '2026-05-10' },
  { label: 'Band A/B/C revision', date: '2026-05-20' },
  { label: 'Revision period ends', date: '2026-06-05' },
  { label: 'HKDSE results release', date: '2026-07-15' },
  { label: 'Main round offers', date: '2026-08-10' },
];

function getNextMilestone() {
  const today = new Date().toISOString().slice(0, 10);
  return JUPAS_MILESTONES.find(m => m.date >= today) || null;
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ConsultantTask() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = 'academic_plan'; // hardcoded for school choice; future: from route param

  // Chat wrapper: consultant chat needs taskId
  const chatFn = useCallback(
    (studentId, message) => sendConsultantChat(taskId, studentId, message),
    [taskId]
  );

  // --- shared plan workspace ---
  const {
    student,
    account,
    plan,
    setPlan,
    loading,
    error,
    setError,
    activeTemplate,
    handleTemplateChange,
    templateLoading,
    exporting: isExportingHTML,
    handleExportHTML,
    editMode,
    setEditMode,
    editingSection,
    setEditingSection,
    sectionSaving,
    handleSaveSection,
    handleResetSection,
    buildSectionList,
    messages,
    chatInput,
    setChatInput,
    chatLoading,
    chatError,
    chatDisabled,
    handleSendChat,
    handleChatKeyDown,
    messagesEndRef,
    chatTextareaRef,
    loadPlan,
  } = usePlanWorkspace({ studentId: id, chatFn });

  // --- PDF export state ---
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const handleExportPDF = useCallback(async () => {
    setIsExportingPDF(true);
    try {
      await exportPlanPDF(id);
      toast.success(t('plan.exportPdf'));
    } catch (err) {
      toast.error(err?.message || 'PDF export failed');
    } finally {
      setIsExportingPDF(false);
    }
  }, [id, t]);

  // --- SSE streaming state (ConsultantTask-unique) ---
  const [streaming, setStreaming] = useState(false);
  const [streamTokens, setStreamTokens] = useState('');
  const [streamError, setStreamError] = useState(null);
  const eventSourceRef = useRef(null);
  const streamTokensRef = useRef(''); // CRITICAL: ref to avoid stale closure in done handler

  // --- counselor metrics toggle ---
  const [showCounselorMetrics, setShowCounselorMetrics] = useState(false);
  const iframeRef = useRef(null);

  // --- mobile chat toggle ---
  const [showChat, setShowChat] = useState(false);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // --- Generate Plan handler (SSE streaming) ---
  const doneHandledRef = useRef(false);
  const handleGenerate = useCallback(() => {
    setStreaming(true);
    setStreamTokens('');
    setStreamError(null);
    streamTokensRef.current = '';
    doneHandledRef.current = false;

    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${base}/api/v1/consultant/tasks/${taskId}/stream?entity_id=${id}&force=true&token=${token}`;
    const source = new EventSource(url);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      streamTokensRef.current += event.data;
      setStreamTokens((prev) => prev + event.data);
    };

    source.addEventListener('done', async () => {
      doneHandledRef.current = true;
      source.close();
      eventSourceRef.current = null;
      const accumulatedTokens = streamTokensRef.current;
      try {
        const result = await saveConsultantTask(taskId, id, accumulatedTokens);
        setPlan(result);
        await loadPlan();
        toast.success(t('plan.planGenerated'));
      } catch (err) {
        setStreamError(t('consultant.saveFailed'));
      }
      setStreaming(false);
      setStreamTokens('');
      streamTokensRef.current = '';
    });

    source.onerror = () => {
      // EventSource fires onerror when server closes connection — ignore if done already handled
      if (doneHandledRef.current) return;
      source.close();
      eventSourceRef.current = null;
      // If we received tokens, the stream worked but connection closed before done event
      if (streamTokensRef.current.length > 50) {
        // Try to save what we have
        (async () => {
          try {
            const result = await saveConsultantTask(taskId, id, streamTokensRef.current);
            setPlan(result);
            await loadPlan();
            toast.success(t('plan.planGenerated'));
          } catch {
            setStreamError(t('consultant.interrupted'));
          }
          setStreaming(false);
        })();
      } else {
        setStreamError(t('consultant.interrupted'));
        setStreaming(false);
      }
    };
  }, [id, taskId, setPlan, loadPlan, t]);
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

  // --- Stop generation handler ---
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

  const hasPlan = !streaming && !error && plan?.html_content;
  const sectionList = buildSectionList(plan);

  // --- Radar chart data queries ---
  const gradesQuery = useQuery({
    queryKey: ['grades', id],
    queryFn: () => getGrades(id),
    enabled: !!hasPlan,
  });

  const targetsQuery = useQuery({
    queryKey: ['targets', id],
    queryFn: () => getTargets(id),
    enabled: !!hasPlan,
  });

  const jupasQuery = useQuery({
    queryKey: ['jupas-all'],
    queryFn: getAllProgrammes,
    staleTime: 10 * 60 * 1000,
    enabled: !!hasPlan,
  });

  // Build gradesByCode from grades array
  const gradesByCode = {};
  const gradesArr = Array.isArray(gradesQuery.data) ? gradesQuery.data : (gradesQuery.data?.grades ?? []);
  gradesArr.forEach(g => {
    if (g.subject_code && (g.raw_grade || g.predicted_grade)) {
      gradesByCode[g.subject_code] = g.raw_grade || g.predicted_grade;
    }
  });

  // Get rank 1 target's programme admission stats for benchmark
  const targets = targetsQuery.data?.targets || (Array.isArray(targetsQuery.data) ? targetsQuery.data : []);
  const rank1 = targets.find(t => t.student_rank === 1) || targets[0];
  const rank1Code = rank1?.jupas_code;

  const allProgs = jupasQuery.data?.programmes || (Array.isArray(jupasQuery.data) ? jupasQuery.data : []);
  const rank1Prog = rank1Code ? allProgs.find(p => p.jupas_code === rank1Code) : null;
  const admissionStats = rank1Prog?.admission_stats || {};
  const latestYear = Object.keys(admissionStats).sort().pop();
  const median = latestYear ? admissionStats[latestYear]?.median : null;
  const perSubjectBenchmark = median ? median / 5 : null;

  const radarSubjects = Object.keys(gradesByCode);
  const benchmarkByCode = {};
  if (perSubjectBenchmark) {
    radarSubjects.forEach(code => { benchmarkByCode[code] = perSubjectBenchmark; });
  }

  // --- ConsultantTask-unique styles ---
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
        {'\u2190'} {t('consultant.backTo')} {student?.full_name || t('account.profile')}
      </Link>

      {/* Main toolbar */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <p style={studentNameStyle}>{student?.full_name || t('consultant.consultantTask')}</p>
          {plan?.version && <p style={versionStyle}>{t('plan.version', { version: plan.version })}</p>}
        </div>

        <div style={toolbarRightStyle}>
          {(() => {
            const milestone = getNextMilestone();
            if (!milestone) return null;
            const days = daysUntil(milestone.date);
            return (
              <span style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
                color: days <= 30 ? 'var(--color-error)' : 'var(--color-warning-text)',
                background: days <= 30 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                padding: '2px 10px', borderRadius: 'var(--border-radius-sm)',
                border: `1px solid ${days <= 30 ? 'var(--color-error-border)' : 'var(--color-warning-border)'}`,
              }}>
                {milestone.label}: {new Date(milestone.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} — {days} days
              </span>
            );
          })()}

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

          {hasPlan && (
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              style={{
                ...exportBtnStyle,
                cursor: isExportingPDF ? 'wait' : 'pointer',
              }}
            >
              <FileDown size={16} />
              {isExportingPDF ? t('plan.exporting') : t('plan.exportPdf')}
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
            onTemplateChange={handleTemplateChange}
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
          {/* Plan generation progress */}
          {streaming && (
            <div style={contentZoneStyle}>
              <PlanProgress isActive={streaming} isDone={false} />
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

          {/* Radar chart — above the plan */}
          {hasPlan && radarSubjects.length >= 3 && (
            <div style={{ padding: '0 var(--space-6)', marginBottom: 'var(--space-4)' }}>
              <PlanRadarChart
                gradesByCode={gradesByCode}
                benchmarkByCode={benchmarkByCode}
                subjects={radarSubjects}
                benchmarkLabel={rank1Prog ? `${rank1Code} — ${rank1Prog.name}` : undefined}
              />
            </div>
          )}

          {/* Plan display (two-column) */}
          {hasPlan && (
            <div style={planAreaStyle}>
              <div style={iframeColStyle}>
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
                message={t('plan.noPlan')}
                description={t('consultant.emptyPlanDesc')}
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

export default ConsultantTask;
