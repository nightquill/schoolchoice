import { get } from './helpers';

export const getHkdseTrends = (sitting, cohortId) => {
  const params = {};
  if (sitting) params.sitting = sitting;
  if (cohortId) params.cohort_id = cohortId;
  return get('/api/v1/analytics/hkdse-trends', { params });
};

export const getPopularMajors = (limit = 20) =>
  get('/api/v1/analytics/popular-majors', { params: { limit } });

export const getStudentDirectory = (graduatedOnly = false) =>
  get('/api/v1/analytics/student-directory', { params: graduatedOnly ? { graduated_only: true } : {} });

export const getHkdsePopulationStats = (subjectCode) => {
  const params = {};
  if (subjectCode) params.subject_code = subjectCode;
  return get('/api/v1/analytics/hkdse-population', { params });
};

export const getPlanHistory = (params = {}) =>
  get('/api/v1/analytics/plan-history', { params });

export const getSubmissionHistory = (params = {}) =>
  get('/api/v1/analytics/submission-history', { params });
