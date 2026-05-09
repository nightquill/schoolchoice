import client from '@schoolchoice/ui/api/client';

export const getStudents = (params = {}) =>
  client.get('/api/v1/students', { params }).then((r) => r.data);

export const getStudent = (id) =>
  client.get(`/api/v1/students/${id}`).then((r) => r.data);

export const createStudent = (data) =>
  client.post('/api/v1/students', data).then((r) => r.data);

export const updateStudent = (id, data) =>
  client.put(`/api/v1/students/${id}`, data).then((r) => r.data);

export const deleteStudent = (id) =>
  client.delete(`/api/v1/students/${id}`).then((r) => r.data);

export const graduateStudent = (id, data) =>
  client.post(`/api/v1/students/${id}/graduate`, data).then((r) => r.data);
