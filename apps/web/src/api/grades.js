import { get, post, put, del } from './helpers';

export const getGrades = (studentId) =>
  get(`/api/v1/students/${studentId}/grades`);

export const createGrade = (studentId, data) =>
  post(`/api/v1/students/${studentId}/grades`, data);

export const updateGrade = (studentId, gradeId, data) =>
  put(`/api/v1/students/${studentId}/grades/${gradeId}`, data);

export const deleteGrade = (studentId, gradeId) =>
  del(`/api/v1/students/${studentId}/grades/${gradeId}`);

export const getSubjects = () =>
  get('/api/v1/grades/subjects');
