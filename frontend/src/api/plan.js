import client from './client';

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
