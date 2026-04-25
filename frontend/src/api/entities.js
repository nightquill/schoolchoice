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

// --- Import API functions (DATA-01, DATA-02, DATA-03) ---

export const importParse = (entityName, file) => {
  const formData = new FormData();
  formData.append('file', file);
  // Do NOT set Content-Type — let Axios set multipart boundary automatically (Pitfall 1)
  return client.post(`/api/v1/entities/${entityName}/import/parse`, formData)
    .then((r) => r.data);
};

export const importParseSheet = (entityName, file, sheetName) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post(`/api/v1/entities/${entityName}/import/parse-sheet?sheet_name=${encodeURIComponent(sheetName)}`, formData)
    .then((r) => r.data);
};

export const importValidate = (entityName, payload) =>
  client.post(`/api/v1/entities/${entityName}/import/validate`, payload)
    .then((r) => r.data);

export const importCommit = (entityName, payload) =>
  client.post(`/api/v1/entities/${entityName}/import/commit`, payload)
    .then((r) => r.data);

// --- Export API functions (DATA-04, DATA-06) ---

export const exportEntityCSV = async (entityName, params = {}) => {
  const resp = await client.get(`/api/v1/entities/${entityName}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityName}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportPlanHTML = async (planId) => {
  const resp = await client.get(`/api/v1/entities/plan-export/${planId}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-${planId}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Error CSV export (backend-generated per RESEARCH.md architecture) ---

export const exportErrorCSV = async (entityName, errorRows) => {
  const resp = await client.get(`/api/v1/entities/${entityName}/export/errors`, {
    params: { error_rows: JSON.stringify(errorRows) },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityName}-import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
