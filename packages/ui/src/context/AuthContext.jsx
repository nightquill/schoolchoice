/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback } from 'react';
import { getAccount } from '../api/account';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const isAuthenticated = !!token;

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (t) => {
    localStorage.setItem('token', t);
    setToken(t);
    try {
      const data = await getAccount();
      setUser(data);
    } catch {
      // If account fetch fails after login, clear state
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  }, []);

  // Restore user on mount if token exists
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getAccount()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
