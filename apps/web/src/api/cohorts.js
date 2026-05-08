import client from './client';

export const getCohorts = () =>
  client.get('/api/v1/cohorts').then((r) => r.data);

export const createCohort = (data) =>
  client.post('/api/v1/cohorts', data).then((r) => r.data);

export const getCohort = (id) =>
  client.get(`/api/v1/cohorts/${id}`).then((r) => r.data);

export const updateCohort = (id, data) =>
  client.put(`/api/v1/cohorts/${id}`, data).then((r) => r.data);

export const deleteCohort = (id) =>
  client.delete(`/api/v1/cohorts/${id}`).then((r) => r.data);

export const addCohortMembers = (id, studentIds) =>
  client.post(`/api/v1/cohorts/${id}/members`, { student_ids: studentIds }).then((r) => r.data);

export const removeCohortMember = (id, studentId) =>
  client.delete(`/api/v1/cohorts/${id}/members/${studentId}`).then((r) => r.data);

export const getCohortStats = (id, sitting) => {
  const params = sitting ? { sitting } : {};
  return client.get(`/api/v1/cohorts/${id}/stats`, { params }).then((r) => r.data);
};

export const searchStudents = (params) =>
  client.get('/api/v1/cohorts/students/search', { params }).then((r) => r.data);
