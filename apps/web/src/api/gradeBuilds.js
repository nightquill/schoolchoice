import { get, post, put, del } from './helpers';

export const getGradeBuilds = (studentId) =>
  get(`/api/v1/students/${studentId}/grade-builds`);

export const createGradeBuild = (studentId, name, grades = {}) =>
  post(`/api/v1/students/${studentId}/grade-builds`, { name, grades });

export const updateGradeBuild = (studentId, buildId, data) =>
  put(`/api/v1/students/${studentId}/grade-builds/${buildId}`, data);

export const deleteGradeBuild = (studentId, buildId) =>
  del(`/api/v1/students/${studentId}/grade-builds/${buildId}`);

export const scoreBuild = (studentId, buildId) =>
  post(`/api/v1/students/${studentId}/grade-builds/${buildId}/scores`);
