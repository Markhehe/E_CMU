import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Replaces prop-drilling
import '../../styles/layout.css'; // Path updated for the layout folder

function PageHeader({ onMenuClick }) { // user and onLogout props removed
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { currentUser, logout } = useAuth(); // Pulls data directly from Global State

  useEffect(() => {
    const handleOutsideClick = () => setDropdownOpen(false);

    if (dropdownOpen) {
      window.addEventListener('click', handleOutsideClick);
    }

    return () => window.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen((prev) => !prev);
  };

  return (
    <header className="page-header">
      <div className="header-left">
        <button 
          className="menu-toggle" 
          onClick={onMenuClick}
          aria-label="Toggle Navigation Sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <p className="page-header-org">
          City of Malabon University — Office of The Registrar
        </p>
      </div>

      <div className="header-right">
        {/* Widget wrapper serves as the positioning anchor */}
        <div 
          className="user-profile-widget" 
          onClick={toggleDropdown}
        >
          <div className="user-avatar">
            {currentUser?.initials || 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser?.name || 'User'}</span>
            <span className="user-role">{currentUser?.role === 'admin' ? 'Registrar Admin' : 'BSIT Student'}</span>
          </div>
          <svg 
            className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} 
            width="16" height="16" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>

          {/* Moved the dropdown INSIDE the widget to anchor it properly */}
          {dropdownOpen && (
            <div 
              className="header-dropdown-menu" 
              onClick={(e) => e.stopPropagation()} // Prevents clicking the menu from triggering the widget toggle
            >
              <button onClick={() => setDropdownOpen(false)}>Account Settings</button>
              <button className="text-danger" onClick={logout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default PageHeader;