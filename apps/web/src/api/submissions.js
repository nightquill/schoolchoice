import { get, post } from './helpers';

export const getSubmissions = () => get('/api/v1/submissions');
export const getSubmission = (id) => get(`/api/v1/submissions/${id}`);
export const approveSubmission = (id) => post(`/api/v1/submissions/${id}/approve`);
export const reviseSubmission = (id, notes, flaggedChoices = []) => post(`/api/v1/submissions/${id}/revise`, { notes, flagged_choices: flaggedChoices });
export const rejectSubmission = (id, reason) => post(`/api/v1/submissions/${id}/reject`, { reason });
