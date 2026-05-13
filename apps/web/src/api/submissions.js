import client from '@schoolchoice/ui/api/client';

export const getSubmissions = () => client.get('/api/v1/submissions').then(r => r.data);
export const getSubmission = (id) => client.get(`/api/v1/submissions/${id}`).then(r => r.data);
export const approveSubmission = (id) => client.post(`/api/v1/submissions/${id}/approve`).then(r => r.data);
export const reviseSubmission = (id, notes) => client.post(`/api/v1/submissions/${id}/revise`, { notes }).then(r => r.data);
export const rejectSubmission = (id, reason) => client.post(`/api/v1/submissions/${id}/reject`, { reason }).then(r => r.data);
