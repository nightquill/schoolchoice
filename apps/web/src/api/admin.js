import client from '@schoolchoice/ui/api/client';

export const listUsers = () =>
  client.get('/api/v1/admin/users').then((r) => r.data);

export const createUser = (data) =>
  client.post('/api/v1/admin/users', data).then((r) => r.data);

export const updateUser = (id, data) =>
  client.patch(`/api/v1/admin/users/${id}`, data).then((r) => r.data);

export const deleteUser = (id) =>
  client.delete(`/api/v1/admin/users/${id}`).then((r) => r.data);
