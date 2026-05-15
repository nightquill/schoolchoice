import { get, post } from './helpers';

export const generateActionPlan = (studentId) =>
  post(`/api/v1/students/${studentId}/action-plan`);

export const getActionPlan = (studentId) =>
  get(`/api/v1/students/${studentId}/action-plan`);
