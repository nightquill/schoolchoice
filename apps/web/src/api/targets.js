import { get, post, put, del } from './helpers';

export const getTargets = (studentId, gradeBuildId = null) =>
  get(`/api/v1/students/${studentId}/targets${gradeBuildId ? `?grade_build_id=${gradeBuildId}` : ''}`);

export const addTarget = (studentId, data) =>
  post(`/api/v1/students/${studentId}/targets`, data);

export const updateTarget = (studentId, targetId, data) =>
  put(`/api/v1/students/${studentId}/targets/${targetId}`, data);

export const deleteTarget = (studentId, targetId) =>
  del(`/api/v1/students/${studentId}/targets/${targetId}`);

export const reorderTargets = (studentId, orderedIds) =>
  post(`/api/v1/students/${studentId}/targets/reorder`, { ordered_ids: orderedIds });
