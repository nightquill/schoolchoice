import { get, client } from './helpers';

export const uploadTranscript = (studentId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post(`/api/v1/students/${studentId}/transcript`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const getTranscript = (studentId) =>
  get(`/api/v1/students/${studentId}/transcript`);
