import client from '@schoolchoice/ui/api/client';

export const searchJupas = (q) =>
  client.get('/api/v1/jupas/search', { params: { q, limit: 20 } }).then((r) => r.data);

export const getAllProgrammes = () =>
  client.get('/api/v1/jupas/all').then((r) => r.data);

export const getProgrammeStudents = (jupasCode) =>
  client.get(`/api/v1/jupas/${jupasCode}/students`).then((r) => r.data);
