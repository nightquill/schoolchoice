import { get } from './helpers';

export const searchJupas = (q) =>
  get('/api/v1/jupas/search', { params: { q, limit: 20 } });

export const getAllProgrammes = () =>
  get('/api/v1/jupas/all');

export const getProgrammeStudents = (jupasCode) =>
  get(`/api/v1/jupas/${jupasCode}/students`);
