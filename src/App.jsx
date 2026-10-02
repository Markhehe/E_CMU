import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import Sidebar from './components/layout/Sidebar';
import PageHeader from './components/layout/PageHeader';

import Login from './pages/auth/Login';
import Guide from './pages/Guide';
import Dashboard from './pages/student/Dashboard';
import CreateRequest from './pages/student/CreateRequest';
import AdminDashboard from './pages/admin/AdminDashboard';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import SasoDashboard from './pages/saso/SasoDashboard';
import Settings from './pages/Settings'; // NEW: Imported the Settings page

// DRY Principle: Centralized routing logic for all 4 user types
const getDefaultRoute = (role) => {
  if (!role) return '/login';
  const userRole = role.toUpperCase();
  
  if (userRole === 'ADMIN') return '/admin/dashboard';
  if (userRole === 'FINANCE') return '/finance/dashboard';
  if (userRole === 'SASO') return '/saso/dashboard';
  
  return '/dashboard'; // Default to student
};

function ProtectedRoute({ allowedRole, children }) {
  const { isAuthenticated, currentUser } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  const userRole = currentUser?.role?.toUpperCase();
  if (allowedRole && userRole !== allowedRole.toUpperCase()) {
    return <Navigate to={getDefaultRoute(userRole)} replace />;
  }
  
  return children;
}

function AppShell() {
  const SIDEBAR_BREAKPOINT = 900;
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > SIDEBAR_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth > SIDEBAR_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="app-main">
        <PageHeader onMenuClick={() => setIsSidebarOpen(prev => !prev)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated, currentUser } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated 
              ? <Navigate to={getDefaultRoute(currentUser?.role)} replace /> 
              : <Login />
          } 
        />

        {/* =========================================
            SHARED ROUTES (All authenticated users)
            ========================================= */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* STUDENT ROUTES */}
        <Route element={<ProtectedRoute allowedRole="STUDENT"><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/student/create-request" element={<CreateRequest />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* REGISTRAR ROUTES */}
        <Route element={<ProtectedRoute allowedRole="ADMIN"><AppShell /></ProtectedRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* FINANCE ROUTES */}
        <Route element={<ProtectedRoute allowedRole="FINANCE"><AppShell /></ProtectedRoute>}>
          <Route path="/finance/dashboard" element={<FinanceDashboard />} />
          <Route path="/finance" element={<Navigate to="/finance/dashboard" replace />} />
        </Route>

        {/* SASO ROUTES */}
        <Route element={<ProtectedRoute allowedRole="SASO"><AppShell /></ProtectedRoute>}>
          <Route path="/saso/dashboard" element={<SasoDashboard />} />
          <Route path="/saso" element={<Navigate to="/saso/dashboard" replace />} />
        </Route>

        {/* Catch-all 404 Route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;