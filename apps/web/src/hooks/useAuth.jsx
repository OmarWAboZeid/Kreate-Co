import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/user`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const authError = new Error(data.error || 'Login failed');
        authError.code = data.code || 'LOGIN_FAILED';
        authError.data = data;
        throw authError;
      }
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (email, password, name) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        const authError = new Error(data.error || 'Registration failed');
        authError.code = data.code || 'REGISTRATION_FAILED';
        authError.data = data;
        throw authError;
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const resendVerification = async (email) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const authError = new Error(data.error || 'Failed to resend verification email');
        authError.code = data.code || 'RESEND_VERIFICATION_FAILED';
        authError.data = data;
        throw authError;
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const verifyEmail = async (token) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        const authError = new Error(data.error || 'Failed to verify email');
        authError.code = data.code || 'VERIFY_EMAIL_FAILED';
        authError.data = data;
        throw authError;
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    register,
    resendVerification,
    verifyEmail,
    logout,
    refetch: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
