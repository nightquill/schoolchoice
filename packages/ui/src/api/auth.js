import client from './client';

export const login = (email, password) =>
  client.post('/api/v1/auth/login', { email, password }).then((r) => r.data);

export const register = (email, password) =>
  client.post('/api/v1/auth/register', { email, password }).then((r) => r.data);

export const studentLogin = (candidate_number, password) =>
  client.post('/api/v1/auth/student-login', { candidate_number, password }).then((r) => r.data);
