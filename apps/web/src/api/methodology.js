import client from './client';

export const getMethodology = () =>
  client.get('/api/v1/methodology').then((r) => r.data);
