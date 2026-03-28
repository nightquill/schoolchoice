import client from './client';

export const generateRecommendations = (studentId) =>
  client.post(`/api/v1/students/${studentId}/recommendations`).then((r) => r.data);

export const getRecommendations = (studentId) =>
  client.get(`/api/v1/students/${studentId}/recommendations`).then((r) => r.data);
