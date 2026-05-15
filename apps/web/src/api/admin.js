import { get, post, put, patch, del } from './helpers';

export const listUsers = () =>
  get('/api/v1/admin/users');

export const createUser = (data) =>
  post('/api/v1/admin/users', data);

export const updateUser = (id, data) =>
  patch(`/api/v1/admin/users/${id}`, data);

export const deleteUser = (id) =>
  del(`/api/v1/admin/users/${id}`);

export const getUsersWithPermissions = () =>
  get('/api/v1/admin/users-with-permissions');

export const getCohortPermissions = (cohortId) =>
  get(`/api/v1/admin/cohorts/${cohortId}/permissions`);

export const setCohortPermission = (cohortId, data) =>
  put(`/api/v1/admin/cohorts/${cohortId}/permissions`, data);

export const removeCohortPermission = (cohortId, userId) =>
  del(`/api/v1/admin/cohorts/${cohortId}/permissions/${userId}`);

export const getSubmissionRateLimit = () =>
  get('/api/v1/admin/settings/submission-rate-limit');

export const setSubmissionRateLimit = (limit) =>
  put('/api/v1/admin/settings/submission-rate-limit', { rate_limit: limit });
