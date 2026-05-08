import client from './client';

export const generateActionPlan = (studentId) =>
  client.post(`/api/v1/students/${studentId}/action-plan`).then((r) => r.data);

export const getActionPlan = (studentId) =>
  client.get(`/api/v1/students/${studentId}/action-plan`).then((r) => r.data);
