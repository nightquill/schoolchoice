import { get, post, patch, del, client } from './helpers';

export const generatePlan = (studentId, planType = 'UNIVERSITY') =>
  post(`/api/v1/students/${studentId}/plan`, { plan_type: planType });

export const getPlanStatus = (studentId) =>
  get(`/api/v1/students/${studentId}/plan/status`);

export const getPlan = (studentId) =>
  get(`/api/v1/students/${studentId}/plan`);

export const getPlanHistory = (studentId) =>
  get(`/api/v1/students/${studentId}/plans/history`);

export const deletePlanHistory = (studentId, planId) =>
  client.delete(`/api/v1/students/${studentId}/plans/history/${planId}`);

// REQ-16: Counsellor AI Chat
export const sendPlanChat = (studentId, message) =>
  post(`/api/v1/students/${studentId}/plan/chat`, { message });

// REQ-17: Template selector
export const setPlanTemplate = (studentId, templateId) =>
  patch(`/api/v1/students/${studentId}/plan/template`, { template_id: templateId });

// REQ-17: Per-section editing
export const editPlanSection = (studentId, sectionKey, htmlContent) =>
  patch(`/api/v1/students/${studentId}/plan/section`, { section_key: sectionKey, html_content: htmlContent });

export const resetPlanSection = (studentId, sectionKey) =>
  del(`/api/v1/students/${studentId}/plan/section/${sectionKey}`);

export const exportPlanPDF = async (studentId) => {
  const resp = await client.get(`/api/v1/students/${studentId}/plan/export-pdf`, { responseType: 'blob' });
  const contentType = resp.headers?.['content-type'] || '';
  if (contentType.includes('pdf')) {
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academic-plan.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Fallback: open HTML in new tab for print
    const html = await resp.data.text();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }
};

export const exportPlanHistoryPDF = async (studentId, planId) => {
  const resp = await client.get(`/api/v1/students/${studentId}/plans/history/${planId}/export-pdf`, { responseType: 'blob' });
  const contentType = resp.headers?.['content-type'] || '';
  if (contentType.includes('pdf')) {
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academic-plan-history.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const html = await resp.data.text();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }
};
