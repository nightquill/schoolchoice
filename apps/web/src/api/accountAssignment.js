import { post } from './helpers';

export const assignAccount = (studentId, username = null) =>
  post(`/api/v1/admin/students/${studentId}/assign-account`, { username });

export const bulkAssignAccounts = (studentIds) =>
  post('/api/v1/admin/students/assign-accounts', { student_ids: studentIds });
