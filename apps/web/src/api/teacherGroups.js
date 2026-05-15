import { get, post, put, del } from './helpers';

export const getTeacherGroups = () => get('/api/v1/admin/teacher-groups');
export const createTeacherGroup = (data) => post('/api/v1/admin/teacher-groups', data);
export const updateTeacherGroup = (id, data) => put(`/api/v1/admin/teacher-groups/${id}`, data);
export const deleteTeacherGroup = (id) => del(`/api/v1/admin/teacher-groups/${id}`);
export const getGroupMembers = (id) => get(`/api/v1/admin/teacher-groups/${id}/members`);
export const addGroupMembers = (id, userIds) => post(`/api/v1/admin/teacher-groups/${id}/members`, { user_ids: userIds });
export const removeGroupMember = (groupId, userId) => del(`/api/v1/admin/teacher-groups/${groupId}/members/${userId}`);
export const getGroupPermissions = (id) => get(`/api/v1/admin/teacher-groups/${id}/permissions`);
export const setGroupPermissions = (id, permissions) => put(`/api/v1/admin/teacher-groups/${id}/permissions`, { permissions });
export const getMyPermissions = () => get('/api/v1/account/permissions');
