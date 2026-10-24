/**
 * Component: Settings
 * User profile preferences, security password updates, and notification settings
 * with full form state management and toast alerts.
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AuthService } from '../services/api';
import '../styles/dashboard.css';

// SVG Icons for Settings Navigation
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

function Settings() {
  const { currentUser, updateUserProfile } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [contactPhone, setContactPhone] = useState(currentUser?.contactPhone || '');
  const [contactAddress, setContactAddress] = useState(currentUser?.contactAddress || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security Tab Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Preferences Form State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    setIsSavingProfile(true);
    try {
      const result = await AuthService.updateProfile({
        contactPhone: contactPhone.trim(),
        contactAddress: contactAddress.trim(),
      });
      updateUserProfile({
        contactPhone: result.user.contactPhone,
        contactAddress: result.user.contactAddress,
      });
      addToast('Contact information updated successfully.', 'success');
    } catch (error) {
      addToast(error.message || 'Failed to update contact information.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password Update Submit Handler
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      addToast('Please enter your current password.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      addToast('New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Simulate API async password change delay
      await new Promise((res) => setTimeout(res, 800));
      addToast('Password updated successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      addToast(error.message || 'Failed to update password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Preference Toggle Handler
  const handlePreferenceToggle = (type, value) => {
    if (type === 'email') {
      setEmailNotifs(value);
      addToast(`Email notifications ${value ? 'enabled' : 'disabled'}.`, 'info');
    } else if (type === 'sms') {
      setSmsNotifs(value);
      addToast(`SMS notifications ${value ? 'enabled' : 'disabled'}.`, 'info');
    }
  };

  return (
    <div className="dashboard-page">
      {/* 1. Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Account Settings</h1>
        <p className="dashboard-subtext">
          Manage your personal information and portal preferences.
        </p>
      </header>

      {/* 2. Main Settings Container */}
      <div className="settings-container">

        {/* Settings Navigation Sidebar */}
        <div className="settings-sidebar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <UserIcon />
            <span>Profile Information</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'security'}
            onClick={() => setActiveTab('security')}
            className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          >
            <LockIcon />
            <span>Security & Password</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'preferences'}
            onClick={() => setActiveTab('preferences')}
            className={`settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          >
            <BellIcon />
            <span>Preferences</span>
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="settings-content">

          {/* TAB 1: Profile Information */}
          {activeTab === 'profile' && (
            <div>
              <h2 className="settings-section-title">Profile Information</h2>
              <hr className="settings-divider" />

              <form onSubmit={handleProfileUpdate} data-action-cooldown="protected">
                <div className="settings-profile-grid">
                  <div>
                    <label className="settings-label" htmlFor="profileName">Name on student record</label>
                    <input
                      id="profileName"
                      type="text"
                      value={currentUser?.name || ''}
                      className="form-input"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="settings-label" htmlFor="profileStudentId">Student ID</label>
                    <input
                      id="profileStudentId"
                      type="text"
                      value={currentUser?.studentId || ''}
                      className="form-input role-input"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="settings-label" htmlFor="profileBirthdate">Birthdate</label>
                    <input
                      id="profileBirthdate"
                      type="text"
                      value={currentUser?.birthdate ? new Date(currentUser.birthdate).toLocaleDateString() : ''}
                      className="form-input"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="settings-label" htmlFor="profileEmail">Email Address</label>
                    <input
                      id="profileEmail"
                      type="email"
                      value={currentUser?.email || 'user@cityofmalabonuniversity.edu.ph'}
                      className="form-input"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="settings-label" htmlFor="contactPhone">Contact Number</label>
                    <input
                      id="contactPhone"
                      type="tel"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      className="form-input"
                      maxLength={40}
                      autoComplete="tel"
                      disabled={isSavingProfile}
                    />
                  </div>

                  <div className="full-width-col">
                    <label className="settings-label" htmlFor="contactAddress">Contact Address</label>
                    <textarea
                      id="contactAddress"
                      value={contactAddress}
                      onChange={(event) => setContactAddress(event.target.value)}
                      className="form-input"
                      maxLength={500}
                      autoComplete="street-address"
                      rows={3}
                      disabled={isSavingProfile}
                    />
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn-primary" disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save Contact Information'}
                  </button>
                </div>
              </form>

              <div className="settings-callout-box">
                <p className="settings-note">
                  <strong>* Note:</strong> Your name, student ID, and birthdate come from the Registrar’s student directory. Update your contact number and address here.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Security & Password */}
          {activeTab === 'security' && (
            <div>
              <h2 className="settings-section-title">Security & Password</h2>
              <hr className="settings-divider" />

              <form
                onSubmit={handlePasswordUpdate}
                className="settings-security-form"
                data-action-cooldown="protected"
              >
                <div className="form-field-group">
                  <label className="settings-label" htmlFor="currentPassword">Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-input"
                    required
                    disabled={isUpdatingPassword}
                  />
                </div>

                <div className="form-field-group">
                  <label className="settings-label" htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                    required
                    disabled={isUpdatingPassword}
                  />
                </div>

                <div className="form-field-group">
                  <label className="settings-label" htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                    required
                    disabled={isUpdatingPassword}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary settings-submit-btn"
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: System Preferences */}
          {activeTab === 'preferences' && (
            <div>
              <h2 className="settings-section-title">System Preferences</h2>
              <hr className="settings-divider" />

              <div className="settings-preferences-list">
                <div className="settings-checkbox-item">
                  <input
                    type="checkbox"
                    id="email-notifs"
                    checked={emailNotifs}
                    onChange={(e) => handlePreferenceToggle('email', e.target.checked)}
                  />
                  <label htmlFor="email-notifs">
                    <strong>Enable Email Notifications</strong>
                    <span className="checkbox-subtext">
                      Receive real-time email alerts whenever your document request status updates.
                    </span>
                  </label>
                </div>

                <div className="settings-checkbox-item">
                  <input
                    type="checkbox"
                    id="sms-notifs"
                    checked={smsNotifs}
                    onChange={(e) => handlePreferenceToggle('sms', e.target.checked)}
                  />
                  <label htmlFor="sms-notifs">
                    <strong>Enable SMS Alerts</strong>
                    <span className="checkbox-subtext">
                      Receive text message notifications for urgent clearance holds or ready-for-pickup alerts.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Settings;