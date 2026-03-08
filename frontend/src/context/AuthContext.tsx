import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

interface User {
  username: string;
  role: string;
  discord_id: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isGM: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('vtt_token');
    const savedUser = localStorage.getItem('vtt_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('vtt_token', newToken);
    localStorage.setItem('vtt_user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vtt_token');
    localStorage.removeItem('vtt_user');
  }, []);

  const isAuthenticated = useMemo(() => !!token, [token]);
  const isGM = useMemo(() => user?.role === 'gm', [user]);

  const value = useMemo(() => ({
    user,
    token,
    login,
    logout,
    isAuthenticated,
    isGM
  }), [user, token, login, logout, isAuthenticated, isGM]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
