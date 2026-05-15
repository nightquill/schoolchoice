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
