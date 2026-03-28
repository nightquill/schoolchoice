import client from './client';

export const getSchools = () =>
  client.get('/api/v1/schools').then((r) => r.data);

export const getSchool = (id) =>
  client.get(`/api/v1/schools/${id}`).then((r) => r.data);
