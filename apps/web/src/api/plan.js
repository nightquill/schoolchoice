import client from '@schoolchoice/ui/api/client';

export const generatePlan = (studentId, planType = 'UNIVERSITY') =>
  client.post(`/api/v1/students/${studentId}/plan`, { plan_type: planType }).then((r) => r.data);

export const getPlanStatus = (studentId) =>
  client.get(`/api/v1/students/${studentId}/plan/status`).then((r) => r.data);

export const getPlan = (studentId) =>
  client.get(`/api/v1/students/${studentId}/plan`).then((r) => r.data);

export const getPlanHistory = (studentId) =>
  client.get(`/api/v1/students/${studentId}/plans/history`).then((r) => r.data);

export const deletePlanHistory = (studentId, planId) =>
  client.delete(`/api/v1/students/${studentId}/plans/history/${planId}`);

// REQ-16: Counsellor AI Chat
export const sendPlanChat = (studentId, message) =>
  client.post(`/api/v1/students/${studentId}/plan/chat`, { message }).then((r) => r.data);

// REQ-17: Template selector
export const setPlanTemplate = (studentId, templateId) =>
  client.patch(`/api/v1/students/${studentId}/plan/template`, { template_id: templateId }).then((r) => r.data);

// REQ-17: Per-section editing
export const editPlanSection = (studentId, sectionKey, htmlContent) =>
  client.patch(`/api/v1/students/${studentId}/plan/section`, { section_key: sectionKey, html_content: htmlContent }).then((r) => r.data);

export const resetPlanSection = (studentId, sectionKey) =>
  client.delete(`/api/v1/students/${studentId}/plan/section/${sectionKey}`).then((r) => r.data);
