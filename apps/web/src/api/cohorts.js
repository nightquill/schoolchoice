import { get, post, put, del } from './helpers';

export const getCohorts = () =>
  get('/api/v1/cohorts');

export const createCohort = (data) =>
  post('/api/v1/cohorts', data);

export const getCohort = (id) =>
  get(`/api/v1/cohorts/${id}`);

export const updateCohort = (id, data) =>
  put(`/api/v1/cohorts/${id}`, data);

export const deleteCohort = (id) =>
  del(`/api/v1/cohorts/${id}`);

export const addCohortMembers = (id, studentIds) =>
  post(`/api/v1/cohorts/${id}/members`, { student_ids: studentIds });

export const removeCohortMember = (id, studentId) =>
  del(`/api/v1/cohorts/${id}/members/${studentId}`);

export const getCohortStats = (id, sitting) => {
  const params = sitting ? { sitting } : {};
  return get(`/api/v1/cohorts/${id}/stats`, { params });
};

export const searchStudents = (params) =>
  get('/api/v1/cohorts/students/search', { params });
