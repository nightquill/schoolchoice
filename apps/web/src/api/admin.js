import client from '@schoolchoice/ui/api/client';

export const listUsers = () =>
  client.get('/api/v1/admin/users').then((r) => r.data);

export const createUser = (data) =>
  client.post('/api/v1/admin/users', data).then((r) => r.data);

export const updateUser = (id, data) =>
  client.patch(`/api/v1/admin/users/${id}`, data).then((r) => r.data);

export const deleteUser = (id) =>
  client.delete(`/api/v1/admin/users/${id}`).then((r) => r.data);

export const getUsersWithPermissions = () =>
  client.get('/api/v1/admin/users-with-permissions').then((r) => r.data);

export const getCohortPermissions = (cohortId) =>
  client.get(`/api/v1/admin/cohorts/${cohortId}/permissions`).then((r) => r.data);

export const setCohortPermission = (cohortId, data) =>
  client.put(`/api/v1/admin/cohorts/${cohortId}/permissions`, data).then((r) => r.data);

export const removeCohortPermission = (cohortId, userId) =>
  client.delete(`/api/v1/admin/cohorts/${cohortId}/permissions/${userId}`).then((r) => r.data);

export const getSubmissionRateLimit = () =>
  client.get('/api/v1/admin/settings/submission-rate-limit').then((r) => r.data);

export const setSubmissionRateLimit = (limit) =>
  client.put('/api/v1/admin/settings/submission-rate-limit', { rate_limit: limit }).then((r) => r.data);
