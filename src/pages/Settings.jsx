import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/dashboard.css'; 

function Settings() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="dashboard-page">
      <header className="dashboard-header-container" style={{ marginBottom: '2rem' }}>
        <div className="header-content">
          <h1 style={{ margin: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-heading)' }}>
            Account Settings
          </h1>
          <p className="dashboard-subtext" style={{ margin: '0.25rem 0 0 0' }}>
            Manage your personal information and portal preferences.
          </p>
        </div>
      </header>

      {/* Replaced inline styles with class: settings-container */}
      <div className="settings-container">
        
        {/* Settings Navigation Sidebar */}
        <div className="settings-sidebar">
          <button 
            onClick={() => setActiveTab('profile')}
            className="settings-tab-btn"
            style={{ 
              fontWeight: activeTab === 'profile' ? '600' : '500',
              backgroundColor: activeTab === 'profile' ? '#e9ecef' : 'transparent',
              color: activeTab === 'profile' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Profile Information
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className="settings-tab-btn"
            style={{ 
              fontWeight: activeTab === 'security' ? '600' : '500',
              backgroundColor: activeTab === 'security' ? '#e9ecef' : 'transparent',
              color: activeTab === 'security' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Security & Password
          </button>
          <button 
            onClick={() => setActiveTab('preferences')}
            className="settings-tab-btn"
            style={{ 
              fontWeight: activeTab === 'preferences' ? '600' : '500',
              backgroundColor: activeTab === 'preferences' ? '#e9ecef' : 'transparent',
              color: activeTab === 'preferences' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Preferences
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="settings-content">
          
          {activeTab === 'profile' && (
            <div>
              <h2 className="settings-section-title">Profile Information</h2>
              <hr className="settings-divider" />
              
              <div className="settings-profile-grid">
                <div>
                  <label className="settings-label">Full Name</label>
                  <input type="text" defaultValue={currentUser?.name || ''} className="form-input" disabled />
                </div>
                <div>
                  <label className="settings-label">Role</label>
                  <input type="text" defaultValue={currentUser?.role || ''} className="form-input" style={{ textTransform: 'capitalize' }} disabled />
                </div>
                <div className="full-width-col">
                  <label className="settings-label">Email Address</label>
                  <input type="email" defaultValue={currentUser?.email || 'user@cityofmalabonuniversity.edu.ph'} className="form-input" disabled />
                </div>
              </div>
              <p className="settings-note">
                * Note: Profile information is synced with the university database and cannot be changed here. Contact MIS for corrections.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="settings-section-title">Change Password</h2>
              <hr className="settings-divider" />
              
              <div className="settings-security-form">
                <div>
                  <label className="settings-label">Current Password</label>
                  <input type="password" placeholder="••••••••" className="form-input" />
                </div>
                <div>
                  <label className="settings-label">New Password</label>
                  <input type="password" placeholder="••••••••" className="form-input" />
                </div>
                <button className="btn-primary settings-submit-btn">Update Password</button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h2 className="settings-section-title">System Preferences</h2>
              <hr className="settings-divider" />
              
              <div className="settings-checkbox-group">
                <input type="checkbox" id="email-notifs" defaultChecked />
                <label htmlFor="email-notifs">Enable Email Notifications for document status updates</label>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Settings;