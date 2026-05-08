import client from '@schoolchoice/ui/api/client';

export const getTargets = (studentId) =>
  client.get(`/api/v1/students/${studentId}/targets`).then((r) => r.data);

export const addTarget = (studentId, data) =>
  client.post(`/api/v1/students/${studentId}/targets`, data).then((r) => r.data);

export const updateTarget = (studentId, targetId, data) =>
  client.put(`/api/v1/students/${studentId}/targets/${targetId}`, data).then((r) => r.data);

export const deleteTarget = (studentId, targetId) =>
  client.delete(`/api/v1/students/${studentId}/targets/${targetId}`).then((r) => r.data);

export const reorderTargets = (studentId, orderedIds) =>
  client.post(`/api/v1/students/${studentId}/targets/reorder`, { ordered_ids: orderedIds }).then((r) => r.data);
