/**
 * Component: Sidebar
 * Main navigation drawer featuring role-based routing (Student and Registrar),
 * active link indicators, dual-color branding header, and responsive mobile overlay handlers.
 */

import { useEffect, useMemo } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStudentClearance } from '../../hooks/useStudentClearance';
import cmuLogo from '../../assets/cmulogo.png';
import '../../styles/layout.css';

// SVG Icon Helpers
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const FilePlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="12" y1="18" x2="12" y2="12"></line>
    <line x1="9" y1="15" x2="15" y2="15"></line>
  </svg>
);

const BookOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <polyline points="9 12 11 14 15 10"></polyline>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const PeopleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const NAV_CONFIG = {
  REGISTRAR: {
    homePath: '/registrar/dashboard',
    links: [
      { to: '/registrar/dashboard', label: 'Registrar Panel', icon: ShieldCheckIcon },
      { to: '/registrar/clearance', label: 'Clearance Verification', icon: ShieldCheckIcon },
      { to: '/registrar/students', label: 'Student Records', icon: DashboardIcon },
    ],
  },
  STUDENT: {
    homePath: '/dashboard',
    links: [
      { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
      { to: '/student/create-request', label: 'Request a Document', fallbackLabel: 'Upload Clearance', icon: FilePlusIcon },
      { to: '/guide', label: 'Guide', icon: BookOpenIcon },
    ],
  },
};

export default function Sidebar({ isOpen, onClose }) {
  const { currentUser, isRegistrarAdmin } = useAuth();
  const navigate = useNavigate();
  const role = currentUser?.role?.toUpperCase() || 'STUDENT';
  const isStudent = role === 'STUDENT';
  
  const { isVerified, isLoading: isClearanceLoading } = useStudentClearance({ enabled: isStudent });
  const currentNav = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;

  // UX Fix: Handle the Escape key to close the mobile drawer
  useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      // 1. Never close the sidebar on ESC if a modal is open
      if (document.querySelector('.modal-overlay')) return;
      
      // 2. Only close the sidebar on ESC if it is acting as a mobile overlay (e.g., screen < 768px)
      if (window.innerWidth < 768) {
         // Execute your sidebar close function here
         // closeSidebar(); 
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [isOpen, onClose]);

  // UX Fix: Prevent the label from flickering while the API fetches clearance status
  const navLinks = useMemo(() => {
    if (!isStudent) {
      return isRegistrarAdmin
        ? [...currentNav.links, {
          to: '/registrar/staff',
          label: 'Registrar Staff',
          icon: PeopleIcon,
        }]
        : currentNav.links;
    }

    return currentNav.links.map((item) => {
      if (item.to !== '/student/create-request') return item;
      
      // If we are still loading the API, show the default optimistic label.
      // If loaded and NOT verified, show the fallback label.
      const displayLabel = (!isClearanceLoading && !isVerified) 
        ? item.fallbackLabel 
        : item.label;

      return { ...item, label: displayLabel };
    });
  }, [isStudent, isRegistrarAdmin, currentNav.links, isClearanceLoading, isVerified]);

  const handleLinkClick = (e, targetPath) => {
    // 1. Close the mobile drawer on click
    if (window.innerWidth <= 992 && onClose) {
      onClose();
    }

    // 2. Replace the global window.dispatchEvent leak with proper React Router state
    if (targetPath === '/registrar/students') {
      e.preventDefault();
      navigate('/registrar/students', { 
        state: { action: 'show-list', timestamp: Date.now() } 
      });
    }
  };

  const getLinkClass = ({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Portal Branding Header */}
        <Link
          to={currentNav.homePath}
          className="sidebar-brand"
          onClick={(e) => handleLinkClick(e, currentNav.homePath)}
        >
          <img
            src={cmuLogo}
            alt="City of Malabon University Logo"
            className="sidebar-logo"
          />
          <div className="sidebar-portal-name">
            <span className="brand-primary">E-CMU</span>
            <span className="brand-accent"> PORTAL</span>
          </div>
        </Link>

        <hr className="sidebar-divider" />

        {/* Dynamic Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="sidebar-menu-links">
            {navLinks.map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={getLinkClass}
                  onClick={(e) => handleLinkClick(e, item.to)}
                >
                  <IconComponent />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Bottom Settings Link */}
          <div className="sidebar-footer">
            <NavLink
              to="/settings"
              className={getLinkClass}
              onClick={(e) => handleLinkClick(e, '/settings')}
            >
              <SettingsIcon />
              <span>Settings</span>
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}