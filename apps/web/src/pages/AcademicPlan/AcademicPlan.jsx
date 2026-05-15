// REQ-096, REQ-099: Academic Plan Page — async plan generation with polling
// REQ-16: Counsellor AI Chat panel
// REQ-17: Template selector + per-section TipTap editing
// Refactored to use shared usePlanWorkspace, ChatPanel, and planStyles
import { useState, useEffect, useRef, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui';
import PlanSectionEditor from '../../components/PlanSectionEditor/PlanSectionEditor';
import { TemplateSelector } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { generatePlan, getPlanStatus, getPlan } from '../../api/plan';
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

const POLL_INTERVAL_MS = 2000;

function AcademicPlan() {
  const { t } = useTranslation();
  const { id } = useParams();

  // --- shared plan workspace (no chatFn — default sendPlanChat is correct) ---
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
  } = usePlanWorkspace({ studentId: id });

  // --- AcademicPlan-unique: polling-based plan generation ---
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [planStatus, setPlanStatus] = useState(null);
  const [planType, setPlanType] = useState('UNIVERSITY');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

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
          toast.success(t('plan.planReady'));
        } else if (statusValue === 'FAILED') {
          stopPolling();
          setError('Plan generation failed. Please try again.');
          toast.error(t('plan.saveFailed'));
        }
      } catch {
        stopPolling();
        setError('Failed to check plan status.');
      }
    }, POLL_INTERVAL_MS);
  }, [id, stopPolling, setPlan, setError, t]);

  // Check plan status after shared hook finishes loading
  useEffect(() => {
    if (loading) return;
    // If the hook already loaded a plan with html_content, mark as DONE
    if (plan?.html_content) {
      setPlanStatus('DONE');
      return;
    }
    // Otherwise check if there's a pending/running generation
    getPlanStatus(id)
      .then((statusData) => {
        if (statusData) {
          const sv = (statusData.status || statusData).toUpperCase();
          setPlanStatus(sv);
          if (sv === 'PENDING' || sv === 'RUNNING') {
            startPolling();
          }
        }
      })
      .catch(() => {
        // no status available — that's fine
      });

    return () => stopPolling();
  }, [loading, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generatePlan(id, planType);
      setPlanStatus('pending');
      setPlan(null);
      startPolling();
    } catch {
      toast.error('Failed to start plan generation.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelPolling = () => {
    stopPolling();
    setPlanStatus(null);
  };

  const isGenerating = polling || planStatus === 'PENDING' || planStatus === 'RUNNING';
  const hasPlan = !isGenerating && !error && plan?.html_content;

  // --- AcademicPlan-unique styles ---
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

  const sectionList = buildSectionList(plan);

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to={`/students/${id}/profile`} style={backLinkStyle}>{t('plan.backToProfile')}</Link>

      {/* Main toolbar */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <p style={studentNameStyle}>{student?.full_name || 'Academic Plan'}</p>
          {plan?.version && (
            <p style={versionStyle}>Plan v{plan.version}</p>
          )}
        </div>

        {/* Plan type selector (AcademicPlan-unique) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {['UNIVERSITY', 'HIGH_SCHOOL'].map((type) => (
            <button
              key={type}
              onClick={() => setPlanType(type)}
              disabled={isGenerating}
              style={planTypeBtnStyle(planType === type)}
            >
              {type === 'UNIVERSITY' ? t('plan.universityPlan') : t('plan.highSchoolPlan')}
            </button>
          ))}
        </div>

        <Button
          label={t('plan.generatePlan')}
          variant="primary"
          onClick={handleGeneratePlan}
          loading={generating || isGenerating}
          disabled={isGenerating}
        />

        <div style={toolbarRightStyle}>
          {plan?.html_content && (
            <Button label={t('plan.print')} variant="secondary" onClick={() => window.print()} />
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
            onTemplateChange={handleTemplateChange}
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
              {editMode ? t('plan.doneEditing') : t('plan.editSections')}
            </button>
          </div>
        </div>
      )}

      {/* Section list — visible when editMode is on */}
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
                ✏ {sec.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={contentZoneStyle}><LoadingSpinner label={t("plan.loading")} /></div>}

      {!loading && (
        <>
          {isGenerating && (
            <div style={{ ...contentZoneStyle, gap: 'var(--space-4)', padding: 'var(--space-8)' }}>
              <LoadingSpinner label={t("plan.generatingPlan")} />
              <div role="status" aria-live="polite">
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', textAlign: 'center', margin: '0 0 var(--space-2) 0' }}>
                  {t('plan.generatingPlan')}
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
                  {t('plan.generatingDesc')}
                </p>
              </div>
              <Button label={t('plan.cancel')} variant="secondary" onClick={handleCancelPolling} />
            </div>
          )}

          {!isGenerating && error && (
            <div style={{ ...contentZoneStyle, padding: 'var(--space-8)' }}>
              <ErrorMessage message={error} />
              <Button label={t('plan.generatePlan')} variant="primary" onClick={handleGeneratePlan} />
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
              <EmptyState message={t('plan.noPlanGenerated')} />
              <Button label={t('plan.generatePlan')} variant="primary" onClick={handleGeneratePlan} loading={generating} />
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

    </div>
  );
}

export default AcademicPlan;
