import client from './client';

export const getEntities = () =>
  client.get('/api/v1/entities').then((r) => r.data);

export const getEntitySchema = (name) =>
  client.get(`/api/v1/entities/${name}/schema`).then((r) => r.data);

export const getEntityList = (tableName) =>
  client.get(`/api/v1/${tableName}`).then((r) => r.data);

export const getEntityDetail = (tableName, id) =>
  client.get(`/api/v1/${tableName}/${id}`).then((r) => r.data);

export const createEntity = (tableName, data) =>
  client.post(`/api/v1/${tableName}`, data).then((r) => r.data);

export const updateEntity = (tableName, id, data) =>
  client.put(`/api/v1/${tableName}/${id}`, data).then((r) => r.data);

export const deleteEntity = (tableName, id) =>
  client.delete(`/api/v1/${tableName}/${id}`).then((r) => r.data);
