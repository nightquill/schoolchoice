import client from '@schoolchoice/ui/api/client';

export const getHkdseTrends = (sitting, cohortId) => {
  const params = {};
  if (sitting) params.sitting = sitting;
  if (cohortId) params.cohort_id = cohortId;
  return client.get('/api/v1/analytics/hkdse-trends', { params }).then((r) => r.data);
};

export const getPopularMajors = (limit = 20) =>
  client.get('/api/v1/analytics/popular-majors', { params: { limit } }).then((r) => r.data);

export const getStudentDirectory = (graduatedOnly = false) =>
  client.get('/api/v1/analytics/student-directory', { params: graduatedOnly ? { graduated_only: true } : {} }).then((r) => r.data);

export const getHkdsePopulationStats = (subjectCode) => {
  const params = {};
  if (subjectCode) params.subject_code = subjectCode;
  return client.get('/api/v1/analytics/hkdse-population', { params }).then((r) => r.data);
};
