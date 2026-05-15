import { get, post, put, del } from './helpers';

export const getStudents = (params = {}) =>
  get('/api/v1/students', { params });

export const getStudent = (id) =>
  get(`/api/v1/students/${id}`);

export const createStudent = (data) =>
  post('/api/v1/students', data);

export const updateStudent = (id, data) =>
  put(`/api/v1/students/${id}`, data);

export const deleteStudent = (id) =>
  del(`/api/v1/students/${id}`);

export const graduateStudent = (id, data) =>
  post(`/api/v1/students/${id}/graduate`, data);
