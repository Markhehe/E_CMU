/**
 * Module: App & Routing Architecture
 * Central application shell defining role-based access control (RBAC),
 * protected route guards, app-shell layouts, and route navigation trees.
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layout Shell Components
import Sidebar from './components/layout/Sidebar';
import PageHeader from './components/layout/PageHeader';

// Page Views
import Login from './pages/auth/Login';
import Guide from './pages/Guide';
import Dashboard from './pages/student/Dashboard';
import CreateRequest from './pages/student/CreateRequest';
import AdminDashboard from './pages/admin/AdminDashboard';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import SasoDashboard from './pages/saso/SasoDashboard';
import Settings from './pages/Settings';
import ActionCooldown from './components/ui/ActionCooldown';

/**
 * Normalizes role strings and returns the primary home dashboard route.
 */
const getDefaultRoute = (role) => {
  if (!role) return '/login';
  const userRole = role.toUpperCase();

  switch (userRole) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'FINANCE':
      return '/finance/dashboard';
    case 'SASO':
      return '/saso/dashboard';
    case 'STUDENT':
    default:
      return '/dashboard';
  }
};

/**
 * Route Guard Component for Role-Based Access Control (RBAC).
 * Intercepts unauthenticated requests and handles unauthorized role redirects.
 */
function ProtectedRoute({ allowedRole, allowedRoles, children }) {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

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

  return children;
}

/**
 * Application Shell Layout Wrapper
 * Encapsulates responsive sidebar drawer, top header bar, and nested page outlet.
 */
function AppShell() {
  const SIDEBAR_BREAKPOINT = 900;
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
        <main className="main-content">
          <Outlet />
        </main>
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

        {/* REGISTRAR ADMIN ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="ADMIN">
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* FINANCE ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="FINANCE">
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/finance/dashboard" element={<FinanceDashboard />} />
          <Route path="/finance" element={<Navigate to="/finance/dashboard" replace />} />
        </Route>

        {/* SASO CLEARANCE ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="SASO">
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/saso/dashboard" element={<SasoDashboard />} />
          <Route path="/saso" element={<Navigate to="/saso/dashboard" replace />} />
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