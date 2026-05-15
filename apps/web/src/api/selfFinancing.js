import { get } from './helpers';

export const getSfInstitutions = () => get('/api/v1/sf/institutions');
export const getSfInstitution = (code) => get(`/api/v1/sf/institutions/${code}`);
export const getSfProgrammes = (params = {}) => get('/api/v1/sf/programmes', { params });
export const getSfProgrammeStudents = (progId) => get(`/api/v1/sf/programmes/${progId}/students`);
