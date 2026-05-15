import { get, post, put, del, client } from './helpers';

const SAFE_TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function validateTableName(tableName) {
  if (!SAFE_TABLE_NAME.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

export const getEntities = () =>
  get('/api/v1/entities');

export const getEntitySchema = (name) =>
  get(`/api/v1/entities/${name}/schema`);

export const getEntityList = (tableName, params = {}) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}`, { params }).then((r) => {
    const data = r.data;
    // Some endpoints return {items: [...], total: N}, others return a plain array
    if (data && Array.isArray(data.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  });
};

export const getEntityDetail = (tableName, id) => {
  validateTableName(tableName);
  return get(`/api/v1/${tableName}/${id}`);
};

export const createEntity = (tableName, data) => {
  validateTableName(tableName);
  return post(`/api/v1/${tableName}`, data);
};

export const updateEntity = (tableName, id, data) => {
  validateTableName(tableName);
  return put(`/api/v1/${tableName}/${id}`, data);
};

export const deleteEntity = (tableName, id) => {
  validateTableName(tableName);
  return del(`/api/v1/${tableName}/${id}`);
};

// --- Import API functions (DATA-01, DATA-02, DATA-03) ---

export const importParse = (entityName, file) => {
  const formData = new FormData();
  formData.append('file', file);
  // Do NOT set Content-Type — let Axios set multipart boundary automatically (Pitfall 1)
  return post(`/api/v1/entities/${entityName}/import/parse`, formData);
};

export const importParseSheet = (entityName, file, sheetName) => {
  const formData = new FormData();
  formData.append('file', file);
  return post(`/api/v1/entities/${entityName}/import/parse-sheet?sheet_name=${encodeURIComponent(sheetName)}`, formData);
};

export const importValidate = (entityName, payload) =>
  post(`/api/v1/entities/${entityName}/import/validate`, payload);

export const importCommit = (entityName, payload) =>
  post(`/api/v1/entities/${entityName}/import/commit`, payload);

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
