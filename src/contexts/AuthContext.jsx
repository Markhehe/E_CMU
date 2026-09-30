import { createContext, useState, useContext, useMemo, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Check localStorage on initial load to keep users logged in after a refresh
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedSession = localStorage.getItem('cmu_session');
      return savedSession ? JSON.parse(savedSession) : null;
    } catch (error) {
      console.error("Failed to parse session from local storage:", error);
      return null;
    }
  });

  // useCallback prevents these functions from being recreated on every render
  const login = useCallback((userData) => {
    /**
     * Expected userData shape:
     * { id: string, name: string, role: 'ADMIN' | 'STUDENT' }
     */
    localStorage.setItem('cmu_session', JSON.stringify(userData));
    setCurrentUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cmu_session');
    setCurrentUser(null);
  }, []);

  // useMemo prevents all components consuming this context from 
  // re-rendering unless currentUser actually changes.
  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'ADMIN',
    login,
    logout
  }), [currentUser, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to grab auth data cleanly in any file
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};