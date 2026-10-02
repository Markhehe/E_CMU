import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import cmuLogo from '../../assets/cmulogo.png';
import '../../styles/layout.css';

function Sidebar({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const role = currentUser?.role?.toUpperCase();

  const handleLinkClick = () => {
    if (window.innerWidth <= 900) {
      onClose();
    }
  };

  const getLinkClass = ({ isActive }) => 
    `sidebar-link ${isActive ? 'active' : ''}`;

  let homePath = '/dashboard';
  if (role === 'ADMIN') homePath = '/admin/dashboard';
  else if (role === 'FINANCE') homePath = '/finance/dashboard';
  else if (role === 'SASO') homePath = '/saso/dashboard';

  return (
    <>
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={onClose} 
          aria-hidden="true" 
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        
        <Link 
          to={homePath} 
          className="sidebar-brand" 
          onClick={handleLinkClick}
          style={{ textDecoration: 'none' }}
        >
          <img src={cmuLogo} alt="CMU Logo" className="sidebar-logo" />
          <div className="sidebar-portal-name">
            <span style={{ color: '#FFFFFF' }}>E-CMU</span> 
            <span style={{ color: 'var(--honey-bronze)' }}> PORTAL</span>
          </div>
        </Link>
        
        <hr className="sidebar-divider" />

        {/* Added flex: 1 and display: flex so the nav spans the full remaining height */}
        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          
          {role === 'ADMIN' && (
            <NavLink to="/admin/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Registrar Panel
            </NavLink>
          )}

          {role === 'FINANCE' && (
            <NavLink to="/finance/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Finance Panel
            </NavLink>
          )}

          {role === 'SASO' && (
            <NavLink to="/saso/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Clearance Panel
            </NavLink>
          )}

          {(!role || role === 'STUDENT') && (
            <>
              <NavLink to="/dashboard" className={getLinkClass} onClick={handleLinkClick}>
                Dashboard
              </NavLink>
              <NavLink to="/student/create-request" className={getLinkClass} onClick={handleLinkClick}>
                Request a document
              </NavLink>
              <NavLink to="/guide" className={getLinkClass} onClick={handleLinkClick}>
                Guide
              </NavLink>
            </>
          )}

          {/* Settings block pushed firmly to the bottom */}
          <div style={{ 
            marginTop: 'auto', 
            paddingTop: '2rem',
            width: '100%'
          }}>
            <NavLink 
              to="/settings" 
              className={getLinkClass} 
              onClick={handleLinkClick}
              style={{ 
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem' // Creates clean spacing between icon and text
              }} 
            >
              {/* Premium SVG Gear Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;