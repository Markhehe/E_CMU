/**
 * Component: PageHeader
 * Top navigation bar featuring mobile menu triggers, university branding,
 * user profile identity, and an accessible account settings dropdown menu.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationService } from '../../services/api';
import { useServerEvents } from '../../hooks/useServerEvents';
import '../../styles/layout.css';

function PageHeader({ onMenuClick }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const isRegistrar = currentUser?.role === 'REGISTRAR';

  const registrarNotificationGroups = [
    {
      title: 'Newly submitted requests',
      types: ['registrar_request_submitted'],
    },
    {
      title: 'Clearance verification requests',
      types: ['registrar_clearance_submitted'],
    },
    {
      title: 'Payment proofs',
      types: ['registrar_payment_proof_submitted'],
    },
    {
      title: 'Overdue ETA update requests',
      types: ['registrar_eta_update_requested'],
    },
  ].map((group) => ({
    ...group,
    count: notifications.filter((notification) => group.types.includes(notification.type)).length,
  }));
  
  const registrarItemsCount = registrarNotificationGroups.reduce(
    (total, group) => total + group.count,
    0,
  );

  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingNotifications(true);
    try {
      const result = await NotificationService.getMine();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message || 'Unable to load notifications.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const timeoutId = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentUser?.id, loadNotifications]);

  useServerEvents(
    isRegistrar ? ['requests', 'clearances'] : 'notifications',
    loadNotifications,
    Boolean(currentUser?.id),
  );

  const roleLabels = {
    REGISTRAR: 'Registrar Officer',
    STUDENT: 'Student',
  };

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };

    if (dropdownOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen, notificationsOpen]);

  const toggleDropdown = () => {
    setNotificationsOpen(false);
    setDropdownOpen((prev) => !prev);
  };

  const toggleNotifications = () => {
    setDropdownOpen(false);
    if (!notificationsOpen) loadNotifications();
    setNotificationsOpen((prev) => !prev);
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await NotificationService.markRead(notificationId);
      setNotifications((current) => current.map((notification) => (
        notification.id === notificationId
          ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
          : notification
      )));
      // 1. REPAIRED: Corrected decrement math
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      setNotificationError(error.message || 'Unable to update notification.');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await NotificationService.markAllRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt,
      })));
      setUnreadCount(0);
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message || 'Unable to mark notifications as read.');
    }
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    navigate('/settings');
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    logout();
  };

  const renderNotification = (notification) => {
    const isRegistrarClearance = notification.type === 'registrar_clearance_submitted';
    const notificationTarget = isRegistrar
      ? isRegistrarClearance ? '/registrar/clearance' : '/registrar/dashboard'
      : notification.type.startsWith('clearance_')
        ? { pathname: '/dashboard', hash: '#student-clearance' }
        : { pathname: '/dashboard' };

    return (
      <li key={notification.id}>
        <Link
          to={notificationTarget}
          state={!isRegistrar ? {
            notification: {
              id: notification.id,
              type: notification.type,
              requestId: notification.request_id,
              commentId: notification.comment_id,
              title: notification.title,
              message: notification.message,
            },
          } : undefined}
          className={`header-notification-item${notification.read_at ? '' : ' is-unread'}`}
          onClick={() => {
            if (!isRegistrar && !notification.read_at) markNotificationRead(notification.id);
            setNotificationsOpen(false);
          }}
        >
          <strong>{notification.title}</strong>
          <span>{notification.message}</span>
          <time dateTime={notification.created_at}>
            {new Date(notification.created_at).toLocaleString()}
          </time>
        </Link>
      </li>
    );
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
        <div ref={notificationsRef} className="header-notifications-wrapper">
          <button
            type="button"
            className={`header-notifications-button${notificationsOpen ? ' is-open' : ''}`}
            onClick={toggleNotifications}
            aria-label="Notifications"
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
            title="Notifications"
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="header-notification-count"
                aria-label={isRegistrar ? `${unreadCount} unresolved registrar items` : `${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              {/* 2. BACKDROP OVERLAY: Dims background on mobile & handles tap-outside close */}
              <div
                className="header-notifications-backdrop"
                onClick={() => setNotificationsOpen(false)}
                aria-hidden="true"
              />

              <section
                className="header-notifications-panel"
                role="dialog"
                aria-label="Notifications"
              >
                <div className="header-notifications-heading">
                  <h2>{isRegistrar ? 'Registrar Inbox' : 'Notifications'}</h2>
                  {!isRegistrar && unreadCount > 0 && (
                    <button type="button" onClick={markAllNotificationsRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notificationError ? (
                  <div className="header-notifications-state" role="alert">
                    <p>{notificationError}</p>
                    <button type="button" onClick={loadNotifications}>Try again</button>
                  </div>
                ) : isLoadingNotifications && notifications.length === 0 ? (
                  <p className="header-notifications-state" role="status">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <p className="header-notifications-state">
                    {isRegistrar ? 'No new requests, clearance submissions, payment proofs, or ETA update requests.' : 'You’re all caught up.'}
                  </p>
                ) : isRegistrar ? (
                  <div className="registrar-inbox-summary">
                    <strong>
                      {registrarItemsCount} {registrarItemsCount === 1 ? 'item needs' : 'items need'} resolution
                    </strong>
                    {registrarNotificationGroups.map((group) => {
                      const isClearanceGroup = group.types.includes('registrar_clearance_submitted');
                      const statusFilter = group.types.includes('registrar_payment_proof_submitted')
                        ? 'PENDING PAYMENT'
                        : group.types.includes('registrar_eta_update_requested')
                          ? 'OVERDUE'
                          : 'PENDING REVIEW';

                      return (
                        <Link
                          key={group.title}
                          to={isClearanceGroup ? '/registrar/clearance' : '/registrar/dashboard'}
                          state={isClearanceGroup ? undefined : { registrarStatusFilter: statusFilter }}
                          className="registrar-inbox-group-link"
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <span>{group.title}</span>
                          <strong>{group.count}</strong>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="header-notification-list">
                    {notifications.map(renderNotification)}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

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