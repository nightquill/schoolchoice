import client from './client';

export const getAccount = () =>
  client.get('/api/v1/account').then((r) => r.data);

export const updateAccount = (data) =>
  client.patch('/api/v1/account', data).then((r) => r.data);

export const changePassword = (data) =>
  client.post('/api/v1/account/change-password', data).then((r) => r.data);

export const deleteAccount = () =>
  client.delete('/api/v1/account').then((r) => r.data);
