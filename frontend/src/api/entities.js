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

export const getEntityList = (tableName, params = {}) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}`, { params }).then((r) => r.data);
};

/**
 * Download entity data as CSV.
 * T-04-16: Uses Axios with auth interceptor (Bearer token) — never a bare <a href>.
 * params may include q= and filters= to match current search/filter state.
 */
export const exportEntityCSV = async (entityName, params = {}) => {
  const response = await client.get(`/api/v1/entities/${entityName}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityName}-export.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * Download academic plan as self-contained HTML file.
 * T-04-18: Uses Axios with auth interceptor — plan-export endpoint requires auth.
 */
export const exportPlanHTML = async (planId) => {
  const response = await client.get(`/api/v1/entities/plan-export/${planId}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-${planId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
