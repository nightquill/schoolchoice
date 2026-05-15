import { get, post } from './helpers';

export const generateRecommendations = (studentId) =>
  post(`/api/v1/students/${studentId}/recommendations`);

export const getRecommendations = (studentId) =>
  get(`/api/v1/students/${studentId}/recommendations`);
