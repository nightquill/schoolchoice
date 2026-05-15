// usePlanWorkspace — shared plan management logic for AcademicPlan and ConsultantTask
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { getPlan, sendPlanChat, setPlanTemplate, editPlanSection, resetPlanSection } from '../api/plan';
import { exportPlanHTML } from '../api/entities';
import { getStudent } from '../api/students';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';

/**
 * Shared hook for plan workspace pages (AcademicPlan, ConsultantTask).
 *
 * @param {object} opts
 * @param {string} opts.studentId - student / entity ID (from route params)
 * @param {Function} [opts.chatFn] - async (id, text) => { message } — chat API function.
 *   Defaults to `sendPlanChat`. ConsultantTask passes `sendConsultantChat` (which
 *   wraps its own taskId internally or the caller partially applies it).
 */
export default function usePlanWorkspace({ studentId, chatFn }) {
  const { t } = useTranslation();
  const id = studentId;
  const chatApiFn = chatFn || sendPlanChat;

  // --- core state ---
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- html export state ---
  const [exporting, setExporting] = useState(false);

  // --- template state ---
  const [activeTemplate, setActiveTemplate] = useState('professional');
  const [templateLoading, setTemplateLoading] = useState(false);

  // --- edit sections state ---
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionSaving, setSectionSaving] = useState(false);

  // --- chat state ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatDisabled, setChatDisabled] = useState(false);
  const messagesEndRef = useRef(null);
  const chatTextareaRef = useRef(null);

  // -------------------------------------------------------------------------
  // loadPlan — reload plan data from API
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Initial data fetch
  // -------------------------------------------------------------------------
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
        setError(t('consultant.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Auto-scroll chat to bottom on new messages
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // -------------------------------------------------------------------------
  // handleExportHTML
  // -------------------------------------------------------------------------
  const handleExportHTML = useCallback(async () => {
    if (!plan?.id) return;
    setExporting(true);
    try {
      await exportPlanHTML(plan.id);
      toast.success(t('consultant.exportSuccess'));
    } catch {
      toast.error(t('consultant.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [plan?.id, t]);

  // -------------------------------------------------------------------------
  // handleTemplateChange
  // -------------------------------------------------------------------------
  const handleTemplateChange = useCallback(async (templateId) => {
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
  }, [id, activeTemplate, templateLoading, loadPlan, t]);

  // -------------------------------------------------------------------------
  // handleSendChat
  // -------------------------------------------------------------------------
  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatError(null);
    setMessages((prev) => [...prev, { role: 'user', text, id: crypto.randomUUID() }]);
    setChatLoading(true);
    try {
      const data = await chatApiFn(id, text);
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
            text: t('consultant.apiNotAvailable'),
            id: crypto.randomUUID(),
          },
        ]);
      } else if (status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            text: t('consultant.dailyLimit'),
            id: crypto.randomUUID(),
          },
        ]);
      } else {
        setChatError(t('plan.messageFailed'));
      }
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatApiFn, id, loadPlan, t]);

  // -------------------------------------------------------------------------
  // handleChatKeyDown
  // -------------------------------------------------------------------------
  const handleChatKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  // -------------------------------------------------------------------------
  // handleSaveSection
  // -------------------------------------------------------------------------
  const handleSaveSection = useCallback(async (htmlContent) => {
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
  }, [editingSection, id, loadPlan, t]);

  // -------------------------------------------------------------------------
  // handleResetSection
  // -------------------------------------------------------------------------
  const handleResetSection = useCallback(async () => {
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
  }, [editingSection, id, loadPlan, t]);

  // -------------------------------------------------------------------------
  // buildSectionList — i18n version (from ConsultantTask)
  // -------------------------------------------------------------------------
  const buildSectionList = useCallback((planData) => {
    const sections = [{ key: 'student_summary', label: t('consultant.studentSummary') }];
    const schools = planData?.recommended_schools || [];
    const count = Math.min(schools.length || 0, 5);
    for (let i = 0; i < count; i++) {
      sections.push({
        key: `school_${i}_rationale`,
        label: t('consultant.schoolRationale', { number: i + 1 }),
      });
    }
    sections.push({ key: 'action_plan_notes', label: t('consultant.actionPlanNotes') });
    return sections;
  }, [t]);

  return {
    // Data
    student,
    account,
    plan,
    setPlan,
    loading,
    error,
    setError,

    // Template
    activeTemplate,
    handleTemplateChange,
    templateLoading,

    // Export
    exporting,
    handleExportHTML,

    // Section editing
    editMode,
    setEditMode,
    editingSection,
    setEditingSection,
    sectionSaving,
    handleSaveSection,
    handleResetSection,
    buildSectionList,

    // Chat
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

    // Reload
    loadPlan,
  };
}
