/**
 * Component: PageHeader
 * Top navigation bar featuring mobile menu triggers, university branding,
 * user profile identity, and an accessible account settings dropdown menu.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/layout.css';

function PageHeader({ onMenuClick }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabels = {
    ADMIN: 'Registrar Admin',
    FINANCE: 'Finance Officer',
    SASO: 'SASO Officer',
    STUDENT: 'Requester',
  };

  // Derive display name and two-letter initials dynamically
  const displayName = currentUser?.name || currentUser?.fullName || 'User';
  const userInitials =
    currentUser?.initials ||
    displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() ||
    'U';

  // Click outside and Escape key dismissal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    navigate('/settings');
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <header className="page-header">
      {/* Left Section: Mobile Sidebar Toggle & Branding */}
      <div className="header-left">
        <button
          type="button"
          className="menu-toggle"
          onClick={onMenuClick}
          aria-label="Toggle Navigation Sidebar"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <p className="page-header-org">
          City of Malabon University — Office of The Registrar
        </p>
      </div>

      {/* Right Section: User Avatar & Account Dropdown */}
      <div className="header-right">
        <div ref={dropdownRef} className="user-profile-wrapper">
          <button
            type="button"
            className="user-profile-widget"
            onClick={toggleDropdown}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="User account menu"
          >
            <div className="user-avatar">{userInitials}</div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">
                {roleLabels[currentUser?.role] || 'User'}
              </span>
            </div>
            <svg
              className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Dropdown Menu Overlay */}
          {dropdownOpen && (
            <div className="header-dropdown-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={handleSettingsClick}
              >
                Account Settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="text-danger"
                onClick={handleLogoutClick}
              >
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