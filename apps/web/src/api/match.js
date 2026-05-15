import { get, post } from './helpers';

export const runMatch = (studentId) =>
  post(`/api/v1/students/${studentId}/match`);

export const getMatch = (studentId) =>
  get(`/api/v1/students/${studentId}/match`);

export const getAutoRecommendations = (studentId, limit = 5) =>
  get(`/api/v1/students/${studentId}/recommendations/auto`, { params: { limit } });
