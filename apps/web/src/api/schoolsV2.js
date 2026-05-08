import client from '@schoolchoice/ui/api/client';

export const searchSchools = (params = {}) =>
  client.get('/api/v1/schools', { params }).then((r) => r.data);

export const getSchoolV2 = (id) =>
  client.get(`/api/v1/schools/${id}`).then((r) => r.data);

export const createSchool = (data) =>
  client.post('/api/v1/schools', data).then((r) => r.data);

export const deleteSchool = (id) =>
  client.delete(`/api/v1/schools/${id}`);
