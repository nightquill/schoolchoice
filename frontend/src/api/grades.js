import client from './client';

export const getGrades = (studentId) =>
  client.get(`/api/v1/students/${studentId}/grades`).then((r) => r.data);

export const createGrade = (studentId, data) =>
  client.post(`/api/v1/students/${studentId}/grades`, data).then((r) => r.data);

export const updateGrade = (studentId, gradeId, data) =>
  client.put(`/api/v1/students/${studentId}/grades/${gradeId}`, data).then((r) => r.data);

export const deleteGrade = (studentId, gradeId) =>
  client.delete(`/api/v1/students/${studentId}/grades/${gradeId}`).then((r) => r.data);

export const getSubjects = () =>
  client.get('/api/v1/grades/subjects').then((r) => r.data);
