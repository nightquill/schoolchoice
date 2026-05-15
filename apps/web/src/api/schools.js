import { get } from './helpers';

export const getSchools = () =>
  get('/api/v1/schools');

export const getSchool = (id) =>
  get(`/api/v1/schools/${id}`);
