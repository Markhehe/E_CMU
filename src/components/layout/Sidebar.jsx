/**
 * Component: Sidebar
 * Main navigation drawer featuring role-based routing (Student, Admin, Finance, SASO),
 * active link indicators, dual-color branding header, and responsive mobile overlay handlers.
 */

import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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

const CreditCardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
    <line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

// Declarative Role-Based Navigation Configuration
const NAV_CONFIG = {
  ADMIN: {
    homePath: '/admin/dashboard',
    links: [
      { to: '/admin/dashboard', label: 'Registrar Panel', icon: ShieldCheckIcon },
    ],
  },
  FINANCE: {
    homePath: '/finance/dashboard',
    links: [
      { to: '/finance/dashboard', label: 'Finance Panel', icon: CreditCardIcon },
    ],
  },
  SASO: {
    homePath: '/saso/dashboard',
    links: [
      { to: '/saso/dashboard', label: 'Clearance Panel', icon: ShieldCheckIcon },
    ],
  },
  STUDENT: {
    homePath: '/dashboard',
    links: [
      { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
      { to: '/student/create-request', label: 'Request a Document', icon: FilePlusIcon },
      { to: '/guide', label: 'Guide', icon: BookOpenIcon },
    ],
  },
};

function Sidebar({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const role = currentUser?.role?.toUpperCase() || 'STUDENT';

  const currentNav = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;

  const handleLinkClick = () => {
    if (window.innerWidth <= 900 && onClose) {
      onClose();
    }
  };

  const getLinkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

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
          onClick={handleLinkClick}
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
            {currentNav.links.map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={getLinkClass}
                  onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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

export default Sidebar;