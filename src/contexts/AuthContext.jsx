/**
 * Authentication Context Provider
 * Handles user session lifecycle, normalized role-based flags, and reactive auth states.
 */

import { createContext, useState, useContext, useMemo, useCallback, useEffect } from 'react';
import { AuthService } from '../services/api';

const AuthContext = createContext(null);
const SESSION_KEY = 'cmu_api_session';

/**
 * Normalizes user object from API to session structure
 */
function toSessionUser(user) {
  if (!user) return null;

  const roles = user.roles || (user.role ? [user.role] : []);
  const normalizedRoles = roles.map((r) => String(r).toLowerCase());

  let primaryRole = 'STUDENT';
  if (
    normalizedRoles.includes('administrator')
    || normalizedRoles.includes('admin')
    || normalizedRoles.includes('registrar')
    || normalizedRoles.includes('registrar_staff')
    || normalizedRoles.includes('saso')
  ) {
    primaryRole = 'REGISTRAR';
  }

  const name = user.fullName || user.full_name || user.name || user.email || 'User';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  return {
    id: String(user.id),
    email: user.email,
    name,
    role: primaryRole,
    rawRoles: roles,
    studentId: user.studentId || user.student_id || '',
    birthdate: user.birthdate || '',
    contactPhone: user.contactPhone || user.contact_phone || '',
    contactAddress: user.contactAddress || user.contact_address || '',
    initials,
  };
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      return savedSession ? toSessionUser(JSON.parse(savedSession)) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // Sync / verify session on initial application mount
  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const response = await AuthService.me();
        if (isMounted && response?.user) {
          const userData = toSessionUser(response.user);
          setCurrentUser(userData);
          localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        }
      } catch {
        // If session verification fails on server, fallback to local session if present or stay as-is
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((user) => {
    const userData = toSessionUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    setCurrentUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.warn('Server logout notice:', error.message);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('cmu_session');
      setCurrentUser(null);
    }
  }, []);

  const updateUserProfile = useCallback((updatedFields) => {
    setCurrentUser((prev) => {
      if (!prev) return null;
      const updated = toSessionUser({
        ...prev,
        ...updatedFields,
        roles: prev.rawRoles,
        fullName: updatedFields.name ?? prev.name,
      });
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      // Role Convenience Helpers
      isRegistrar: currentUser?.role === 'REGISTRAR',
      isRegistrarAdmin: currentUser?.rawRoles?.some((role) =>
        ['admin', 'administrator'].includes(String(role).toLowerCase())
      ) ?? false,
      isStudent: currentUser?.role === 'STUDENT',
      hasRole: (roleName) => currentUser?.role === String(roleName).toUpperCase(),
      login,
      logout,
      updateUserProfile,
    }),
    [currentUser, isLoading, login, logout, updateUserProfile]
  );

  // Block rendering unauthenticated routes only if we don't have local data YET and are still loading
  const isVerifying = isLoading && !currentUser;

  return (
    <AuthContext.Provider value={value}>
      {isVerifying ? (
        <div style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          color: '#022360',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: '600'
        }}>
          Verifying session...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};