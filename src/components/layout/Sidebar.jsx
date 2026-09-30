import { NavLink } from 'react-router-dom';
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
        <div className="sidebar-brand">
          <img src={cmuLogo} alt="CMU Logo" className="sidebar-logo" />
          <div className="sidebar-portal-name">
            <span style={{ color: '#FFFFFF' }}>E-CMU</span> 
            <span style={{ color: 'var(--honey-bronze)' }}> PORTAL</span>
          </div>
        </div>
        
        <hr className="sidebar-divider" />

        <nav className="sidebar-nav">
          {/* REGISTRAR LINKS */}
          {role === 'ADMIN' && (
            <NavLink to="/admin/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Registrar Panel
            </NavLink>
          )}

          {/* FINANCE LINKS */}
          {role === 'FINANCE' && (
            <NavLink to="/finance/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Finance Panel
            </NavLink>
          )}

          {/* SASO LINKS */}
          {role === 'SASO' && (
            <NavLink to="/saso/dashboard" className={getLinkClass} onClick={handleLinkClick}>
              Clearance Panel
            </NavLink>
          )}

          {/* STUDENT LINKS */}
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
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;