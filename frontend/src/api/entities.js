import client from './client';

const SAFE_TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function validateTableName(tableName) {
  if (!SAFE_TABLE_NAME.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

export const getEntities = () =>
  client.get('/api/v1/entities').then((r) => r.data);

export const getEntitySchema = (name) =>
  client.get(`/api/v1/entities/${name}/schema`).then((r) => r.data);

export const getEntityList = (tableName) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}`).then((r) => r.data);
};

export const getEntityDetail = (tableName, id) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}/${id}`).then((r) => r.data);
};

export const createEntity = (tableName, data) => {
  validateTableName(tableName);
  return client.post(`/api/v1/${tableName}`, data).then((r) => r.data);
};

export const updateEntity = (tableName, id, data) => {
  validateTableName(tableName);
  return client.put(`/api/v1/${tableName}/${id}`, data).then((r) => r.data);
};

export const deleteEntity = (tableName, id) => {
  validateTableName(tableName);
  return client.delete(`/api/v1/${tableName}/${id}`).then((r) => r.data);
};
