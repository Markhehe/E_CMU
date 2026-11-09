/**
 * Module: App & Routing Architecture
 * Central application shell defining role-based access control (RBAC),
 * protected route guards, app-shell layouts, and route navigation trees.
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useAuth } from './contexts/AuthContext';
import { scrollbarOptions } from './utils/scrollbarOptions';

// Layout Shell Components
import Sidebar from './components/layout/Sidebar';
import PageHeader from './components/layout/PageHeader';

// Page Views
import Login from './pages/auth/Login';
import Guide from './pages/Guide';
import Dashboard from './pages/student/Dashboard';
import CreateRequest from './pages/student/CreateRequest';
import RegistrarDashboard from './pages/registrar/RegistrarDashboard';
import RegistrarClearanceDashboard from './pages/registrar/RegistrarClearanceDashboard';
import RegistrarStudents from './pages/registrar/RegistrarStudents';
import RegistrarStaffManagement from './pages/registrar/RegistrarStaffManagement';
import RegistrarStudentEntry from './pages/registrar/RegistrarStudentEntry';
import RegistrarStudentDirectory from './pages/registrar/RegistrarStudentDirectory';
import RegistrarAuditLog from './pages/registrar/RegistrarAuditLog';
import Settings from './pages/Settings';
import ActionCooldown from './components/ui/ActionCooldown';

/**
 * Normalizes role strings and returns the primary home dashboard route.
 */
const getDefaultRoute = (role) => {
  if (!role) return '/login';
  const userRole = role.toUpperCase();

  switch (userRole) {
    case 'REGISTRAR':
      return '/registrar/dashboard';
    case 'STUDENT':
    default:
      return '/dashboard';
  }
};

/**
 * Route Guard Component for Role-Based Access Control (RBAC).
 * Intercepts unauthenticated requests and handles unauthorized role redirects.
 */
function ProtectedRoute({ allowedRole, allowedRoles, requireRegistrarAdmin = false, children }) {
  const { isAuthenticated, currentUser, isLoading, isRegistrarAdmin } = useAuth();

  // Prevent flash redirects while reading token from persistent storage
  if (isLoading) {
    return (
      <div className="app-loading-screen" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--parchment, #fdfbf7)',
        color: 'var(--imperial-blue, #022360)',
        fontFamily: 'var(--font-heading, sans-serif)',
        fontWeight: '600'
      }}>
        Loading E-CMU Portal...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = currentUser?.role?.toUpperCase();

  // Support single string or array of allowed roles
  const validRoles = allowedRoles
    ? allowedRoles.map((r) => r.toUpperCase())
    : allowedRole
    ? [allowedRole.toUpperCase()]
    : null;

  if (validRoles && !validRoles.includes(userRole)) {
    return <Navigate to={getDefaultRoute(userRole)} replace />;
  }
  if (requireRegistrarAdmin && !isRegistrarAdmin) {
    return <Navigate to={getDefaultRoute(userRole)} replace />;
  }

  return children;
}

/**
 * Application Shell Layout Wrapper
 * Encapsulates responsive sidebar drawer, top header bar, and nested page outlet.
 */
function AppShell() {
  const SIDEBAR_BREAKPOINT = 992;
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth > SIDEBAR_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > SIDEBAR_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="app-main">
        <PageHeader onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
        <OverlayScrollbarsComponent
          element="main"
          className="main-content"
          options={{
            ...scrollbarOptions,
            overflow: { x: 'hidden', y: 'scroll' },
          }}
          defer
        >
          <Outlet />
        </OverlayScrollbarsComponent>
      </div>
    </div>
  );
}

/**
 * Main Application Component & Router Context
 */
function App() {
  const { isAuthenticated, currentUser } = useAuth();

  return (
    <BrowserRouter>
      <ActionCooldown />
      <Routes>
        {/* =========================================
            AUTHENTICATION ROUTE
            ========================================= */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={getDefaultRoute(currentUser?.role)} replace />
            ) : (
              <Login />
            )
          }
        />

        {/* =========================================
            ROOT DIRECT DIRECTORY REDIRECT
            ========================================= */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={getDefaultRoute(currentUser?.role)} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* =========================================
            SHARED AUTHENTICATED ROUTES
            ========================================= */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/settings" element={<Settings />} />
          <Route path="/guide" element={<Guide />} />
        </Route>

        {/* =========================================
            ROLE-SPECIFIC ROUTES
            ========================================= */}

        {/* STUDENT ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="STUDENT">
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/student/create-request" element={<CreateRequest />} />
        </Route>

        {/* REGISTRAR ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="REGISTRAR">
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/registrar/dashboard" element={<RegistrarDashboard />} />
          <Route path="/registrar/clearance" element={<RegistrarClearanceDashboard />} />
          <Route path="/registrar/students" element={<RegistrarStudents />} />
          <Route
            path="/registrar/student-entry"
            element={
              <ProtectedRoute allowedRole="REGISTRAR" requireRegistrarAdmin>
                <RegistrarStudentEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registrar/student-directory"
            element={
              <ProtectedRoute allowedRole="REGISTRAR" requireRegistrarAdmin>
                <RegistrarStudentDirectory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registrar/staff"
            element={
              <ProtectedRoute allowedRole="REGISTRAR" requireRegistrarAdmin>
                <RegistrarStaffManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registrar/audit-log"
            element={
              <ProtectedRoute allowedRole="REGISTRAR" requireRegistrarAdmin>
                <RegistrarAuditLog />
              </ProtectedRoute>
            }
          />
          <Route path="/registrar" element={<Navigate to="/registrar/dashboard" replace />} />
        </Route>

        {/* =========================================
            404 CATCH-ALL REDIRECT
            ========================================= */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;