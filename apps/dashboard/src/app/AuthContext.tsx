'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8787'
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithGoogle: (returnTo?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  loginWithGoogle: () => {},
  logout: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!res.ok) {
        throw new Error('Session expired');
      }

      const data = await res.json();
      setUser(data.user);
      setToken(authToken);
      localStorage.setItem('reelnexus_auth_token', authToken);
    } catch (e) {
      console.warn('Authentication token invalid or expired:', e);
      localStorage.removeItem('reelnexus_auth_token');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for auth_token in URL query (from Google OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('auth_token');
    const authError = urlParams.get('error');

    if (authError) {
      if (authError === 'google_login_cancelled') {
        toast.error('Google login cancelled');
      } else {
        toast.error('Google login failed. Please try again.');
      }
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('error');
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    if (urlToken) {
      // Clean query string
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('auth_token');
      window.history.replaceState({}, '', cleanUrl.toString());

      toast.success('Signed in with Google!');
      fetchUser(urlToken);
      return;
    }

    // Otherwise check localStorage
    const storedToken = localStorage.getItem('reelnexus_auth_token');
    if (storedToken) {
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = (returnTo?: string) => {
    const dest = returnTo || (typeof window !== 'undefined' ? window.location.pathname : '/');
    window.location.href = `${API_BASE}/api/auth/google/login?return_to=${encodeURIComponent(dest)}`;
  };

  const logout = () => {
    localStorage.removeItem('reelnexus_auth_token');
    setUser(null);
    setToken(null);
    toast.success('Signed out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('reelnexus_auth_token');
    if (token) {
      return { ...headers, Authorization: `Bearer ${token}` };
    }
  }
  return headers;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const customHeaders = (options.headers as Record<string, string>) || {};
  return fetch(url, {
    ...options,
    headers: getAuthHeaders(customHeaders)
  });
}

