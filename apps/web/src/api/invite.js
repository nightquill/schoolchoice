import { get, post } from './helpers';

export const validateInvite = (token) =>
  get(`/api/v1/auth/invite/${token}`);

export const acceptInvite = (token, password) =>
  post(`/api/v1/auth/invite/${token}/accept`, { password });

export const bulkInviteStudents = (studentIds) =>
  post('/api/v1/admin/students/invite', { student_ids: studentIds });

export const inviteStudent = (studentId, email) =>
  post(`/api/v1/admin/students/${studentId}/invite`, { email });

export const reinviteStudent = (studentId) =>
  post(`/api/v1/admin/students/${studentId}/reinvite`);

export const forgotPassword = (email) =>
  post('/api/v1/auth/forgot-password', { email });

export const resetPassword = (token, password) =>
  post(`/api/v1/auth/reset-password/${token}`, { password });

export const mergeStudent = (sourceId, targetId) =>
  post(`/api/v1/admin/students/${sourceId}/merge/${targetId}`);

export const sendCredentialsEmail = (email, loginId, password, studentName) =>
  post('/api/v1/admin/send-credentials', {
    email,
    login_id: loginId,
    password,
    student_name: studentName,
  });
