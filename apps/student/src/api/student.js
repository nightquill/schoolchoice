import client from '@schoolchoice/ui/api/client';

export const studentLogin = (email, password) =>
  client.post('/api/v1/auth/login', { email, password }).then(r => r.data);

export const getMyGrades = () =>
  client.get('/api/v1/student/grades').then(r => r.data);

export const getMyChoices = () =>
  client.get('/api/v1/student/choices').then(r => r.data);

export const saveMyChoices = (choices) =>
  client.put('/api/v1/student/choices', { choices }).then(r => r.data);

export const submitChoices = () =>
  client.post('/api/v1/student/choices/submit').then(r => r.data);

export const getMatchScores = () =>
  client.get('/api/v1/student/choices/match').then(r => r.data);

export const searchProgrammes = (q) =>
  client.get('/api/v1/jupas/search', { params: { q, limit: 20 } }).then(r => r.data);
