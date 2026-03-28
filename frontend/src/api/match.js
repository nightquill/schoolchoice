import client from './client';

export const runMatch = (studentId) =>
  client.post(`/api/v1/students/${studentId}/match`).then((r) => r.data);

export const getMatch = (studentId) =>
  client.get(`/api/v1/students/${studentId}/match`).then((r) => r.data);

export const getAutoRecommendations = (studentId, limit = 5) =>
  client.get(`/api/v1/students/${studentId}/recommendations/auto`, { params: { limit } }).then((r) => r.data);
