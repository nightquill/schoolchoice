import { get, post, del, client } from './helpers';

export const searchSchools = (params = {}) =>
  get('/api/v1/schools', { params });

export const getSchoolV2 = (id) =>
  get(`/api/v1/schools/${id}`);

export const createSchool = (data) =>
  post('/api/v1/schools', data);

export const deleteSchool = (id) =>
  client.delete(`/api/v1/schools/${id}`);
