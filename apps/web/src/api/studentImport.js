import client from '@schoolchoice/ui/api/client';

export const previewImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/api/v1/import/students/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const commitImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/api/v1/import/students/commit', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
